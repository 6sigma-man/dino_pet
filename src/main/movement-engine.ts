/**
 * 主进程移动引擎（TECH_DESIGN §2 Movement Engine）。
 * 窗口位置只能由主进程改，故移动循环放 main：16ms ticker + 真实 dt 计算
 * （主进程无 requestAnimationFrame；dt 累加不依赖定时器精度，满足 SKILL §24 防漂移意图）。
 * 路径算法全部委托 shared/movement.ts 纯函数（单测覆盖）。
 * IPC 纪律（SKILL §23）：仅在 phase/edge/facing/moving/activity 变化时向 renderer 推送状态。
 * Phase 6：新增三种活动模式——
 *   patrol 沿工作区四边巡逻；target 走向指定点（点击移动/双击跑开），到达后 IDLE 停顿再恢复；
 *   drag 跟随系统光标移动窗口（拖动，主进程用 screen 轮询光标，避免 renderer 事件丢失）。
 */
import { BrowserWindow, screen } from 'electron';
import { WorkArea } from '../shared/geometry';
import {
  createMoveState,
  facingOn,
  nearestEdgePoint,
  pathRect,
  stepMove,
  Facing,
  MoveMode,
  MoveState,
  PathRect,
} from '../shared/movement';
import {
  IDLE_AFTER_TARGET_MS,
  IPC_CHANNEL_MOVEMENT_STATE,
  IPC_CHANNEL_ARRIVED,
  MOVE_TICK_MS,
  TURN_DURATION_S,
  WALK_BASE_SPEED,
} from '../shared/constants';

/** 活动模式：巡逻 / 走向目标 / 被拖动 */
export type MovementActivity = 'patrol' | 'target' | 'drag';

export interface MovementStatePayload {
  phase: MoveState['phase'];
  edge: MoveState['edge'];
  facing: Facing;
  moving: boolean;
  activity: MovementActivity;
}

export interface MovementEngine {
  setEnabled(enabled: boolean): void;
  setMode(mode: MoveMode): void;
  /** Phase 7 托盘：暂停/恢复自动移动（状态保持，不影响拖/目标等显式指令） */
  setPaused(paused: boolean): void;
  /** Phase 7 托盘：多档速度（px/s） */
  setSpeed(speed: number): void;
  /** Phase 8：切换工作区（显示器）——重算周长并把恐龙投影到新区域内继续巡逻 */
  setWorkArea(workArea: WorkArea): void;
  /** Phase 6：开始拖动（offset = 抓取点相对窗口左上，主进程按光标 - offset 移动窗口） */
  beginDrag(offsetX: number, offsetY: number): void;
  /** Phase 6：结束拖动，在落点恢复巡逻（保持松手位置，不瞬移） */
  endDrag(): void;
  /** Phase 6：走向屏幕坐标点（投影到最近周长边）；返回解析后的落点（供小太阳标记定位） */
  moveToTarget(x: number, y: number): { x: number; y: number };
  /** Phase 6：跑开到随机远处点（双击触发） */
  runAway(): void;
  getPayload(): MovementStatePayload;
  stop(): void;
}

export interface MovementEngineOptions {
  workArea: WorkArea;
  winWidth: number;
  winHeight: number;
  /** 起始窗口左上角（通常 = getInitialPosition） */
  start: { x: number; y: number };
  mode?: MoveMode;
}

export function createMovementEngine(
  win: BrowserWindow,
  opts: MovementEngineOptions,
): MovementEngine {
  const winWidth = opts.winWidth;
  const winHeight = opts.winHeight;
  let rect: PathRect = pathRect(opts.workArea, winWidth, winHeight);
  // 初始站在 BOTTOM 边（脚贴工作区底边），顺时针出发
  let state: MoveState = createMoveState(opts.start.x, rect.maxY, 'BOTTOM', 'cw');
  let mode: MoveMode = opts.mode ?? 'clockwise';
  let enabled = true;
  let paused = false; // Phase 7 托盘暂停：仅冻结 patrol 自动位移
  let walkSpeed = WALK_BASE_SPEED; // Phase 7 多档速度
  let lastMs = Date.now();
  let lastSentKey = '';

  // Phase 6 内部状态
  let activity: MovementActivity = 'patrol';
  let absTarget: { x: number; y: number } | null = null; // 需求扩展④：直线走向的绝对落点（DIP）
  let moveFacing: Facing = 'right'; // 直线移动时的朝向（素材仅左右，竖直移动保持上一次）
  let resumeAt = 0;
  const dragOffset = { x: 0, y: 0 };

  function payload(): MovementStatePayload {
    return {
      phase: state.phase,
      edge: state.edge,
      facing: activity === 'target' ? moveFacing : facingOn(state.edge, state.dir),
      moving: enabled,
      activity,
    };
  }

  function emit(): void {
    const p = payload();
    const key = `${p.phase}|${p.edge}|${p.facing}|${p.moving}|${p.activity}`;
    if (key === lastSentKey) {
      return; // 幂等：状态未变不发 IPC（SKILL §23）
    }
    lastSentKey = key;
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNEL_MOVEMENT_STATE, p);
    }
  }

  /** 把窗口移到 (x,y) 并同步 state 坐标（整数 DIP，连续无瞬移） */
  function setPosition(x: number, y: number): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    state = { ...state, x: ix, y: iy };
    if (!win.isDestroyed()) {
      const [cx, cy] = win.getPosition();
      if (cx !== ix || cy !== iy) {
        win.setPosition(ix, iy);
      }
    }
  }

  function step(dt: number): void {
    const { next } = stepMove(state, dt, {
      rect,
      baseSpeed: walkSpeed,
      turnDuration: TURN_DURATION_S,
      mode,
      rng: Math.random,
    });
    state = next;
    setPosition(state.x, state.y);
  }

  function tick(): void {
    const now = Date.now();
    const dt = Math.min(Math.max((now - lastMs) / 1000, 0), 0.1); // dt 钳制，防休眠恢复瞬移
    lastMs = now;
    if (win.isDestroyed()) {
      return;
    }

    if (activity === 'drag') {
      // 跟随系统光标：窗口左上 = 光标 - 抓取偏移（不依赖 renderer 事件，快拖不丢）
      const c = screen.getCursorScreenPoint();
      setPosition(c.x - dragOffset.x, c.y - dragOffset.y);
      emit();
      return;
    }

    if (activity === 'target') {
      if (dt <= 0) {
        return;
      }
      if (absTarget) {
        // 需求扩展④：直线走向点击落点（可离开屏幕边、上下左右直达）
        const dx = absTarget.x - state.x;
        const dy = absTarget.y - state.y;
        const dist = Math.hypot(dx, dy);
        const stride = walkSpeed * dt;
        if (dist <= stride || dist < 1) {
          // 到达：贴准落点，进入 IDLE 停顿，发一次性到达事件→renderer 吏水×3
          setPosition(absTarget.x, absTarget.y);
          state = { ...state, x: Math.round(absTarget.x), y: Math.round(absTarget.y), phase: 'idle', turnRemaining: 0 };
          absTarget = null;
          resumeAt = now + IDLE_AFTER_TARGET_MS;
          if (!win.isDestroyed()) {
            win.webContents.send(IPC_CHANNEL_ARRIVED);
          }
        } else {
          setPosition(state.x + (dx / dist) * stride, state.y + (dy / dist) * stride);
          // 素材仅左右：水平分量主导时按 dx 定朝向；纯竖直移动保持上一次（侧身平移）
          if (Math.abs(dx) >= Math.abs(dy)) {
            moveFacing = dx >= 0 ? 'right' : 'left';
          }
          state = { ...state, phase: 'walk' };
        }
      } else if (now >= resumeAt) {
        // 停顿结束：贴回最近周长边，恢复四边巡逻
        const near = nearestEdgePoint(state.x, state.y, rect);
        setPosition(near.x, near.y);
        state = { ...state, x: near.x, y: near.y, edge: near.edge, phase: enabled && !paused ? 'walk' : 'idle', turnRemaining: 0 };
        activity = 'patrol';
      }
      emit();
      return;
    }

    // patrol
    if (paused || !enabled || dt <= 0) {
      return;
    }
    step(dt);
    emit();
  }

  const timer = setInterval(tick, MOVE_TICK_MS);
  emit(); // 初始状态推送一次

  return {
    setEnabled(next: boolean): void {
      if (enabled === next) {
        return;
      }
      enabled = next;
      lastMs = Date.now(); // 恢复时不补偿暂停期间的 dt
      if (next && state.phase === 'idle' && activity === 'patrol') {
        state = { ...state, phase: 'walk' };
      }
      if (!next) {
        state = { ...state, phase: 'idle', turnRemaining: 0 };
      }
      emit();
    },
    setMode(next: MoveMode): void {
      mode = next;
    },
    setPaused(next: boolean): void {
      if (paused === next) {
        return;
      }
      paused = next;
      lastMs = Date.now(); // 恢复时不补偿暂停期间的 dt
      if (!next && enabled && activity === 'patrol' && state.phase === 'idle') {
        state = { ...state, phase: 'walk' };
      }
      if (next) {
        state = { ...state, phase: 'idle', turnRemaining: 0 };
      }
      emit();
    },
    setSpeed(next: number): void {
      if (next > 0) {
        walkSpeed = next;
      }
    },
    setWorkArea(workArea: WorkArea): void {
      rect = pathRect(workArea, winWidth, winHeight);
      // 当前点投影到新矩形周长最近合法点（可能跨屏，属预期重定位）
      const near = nearestEdgePoint(state.x, state.y, rect);
      activity = 'patrol';
      absTarget = null;
      lastMs = Date.now();
      state = {
        ...state,
        x: near.x,
        y: near.y,
        edge: near.edge,
        phase: enabled && !paused ? 'walk' : 'idle',
        turnRemaining: 0,
      };
      setPosition(state.x, state.y);
      emit();
    },
    beginDrag(offsetX: number, offsetY: number): void {
      activity = 'drag';
      dragOffset.x = offsetX;
      dragOffset.y = offsetY;
      // 拖动期间置 idle：主进程光标跟随接管，暂停步长累加避免恢复瞬移
      state = { ...state, phase: 'idle', turnRemaining: 0 };
      absTarget = null;
      emit();
    },
    endDrag(): void {
      if (activity !== 'drag') {
        return;
      }
      // 保持松手位置，按当前点取最近边继续巡逻（perpendicular 不硬吸附，避免落点跳变）
      const [cx, cy] = win.getPosition();
      const near = nearestEdgePoint(cx, cy, rect);
      state = { ...state, x: cx, y: cy, edge: near.edge, phase: 'idle', turnRemaining: 0 };
      activity = 'patrol';
      lastMs = Date.now();
      if (enabled) {
        state = { ...state, phase: 'walk' };
      }
      emit();
    },
    moveToTarget(x: number, y: number): { x: number; y: number } {
      // 需求扩展④：直线走向点击点（DIP，夹进合法范围保证整只恐龙在屏内）；太阳标在真实落点
      const tx = Math.max(rect.minX, Math.min(rect.maxX, Math.round(x)));
      const ty = Math.max(rect.minY, Math.min(rect.maxY, Math.round(y)));
      absTarget = { x: tx, y: ty };
      activity = 'target';
      lastMs = Date.now();
      moveFacing = tx >= state.x ? 'right' : 'left';
      state = { ...state, phase: 'walk', turnRemaining: 0 };
      emit();
      return { x: tx, y: ty };
    },
    runAway(): void {
      // 随机挑一个离当前足够远的周长点（最多试 8 次），体现“跑开”
      const edges: MoveState['edge'][] = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'];
      let pick = nearestEdgePoint(state.x, state.y, rect);
      for (let i = 0; i < 8; i += 1) {
        const e = edges[Math.floor(Math.random() * edges.length)];
        const cand =
          e === 'TOP' || e === 'BOTTOM'
            ? { edge: e, x: rect.minX + Math.random() * (rect.maxX - rect.minX), y: e === 'TOP' ? rect.minY : rect.maxY }
            : { edge: e, x: e === 'LEFT' ? rect.minX : rect.maxX, y: rect.minY + Math.random() * (rect.maxY - rect.minY) };
        const d = Math.abs(cand.x - state.x) + Math.abs(cand.y - state.y);
        if (d > (rect.maxX - rect.minX) * 0.35) {
          pick = cand;
          break;
        }
        pick = cand;
      }
      absTarget = { x: pick.x, y: pick.y };
      activity = 'target';
      lastMs = Date.now();
      moveFacing = pick.x >= state.x ? 'right' : 'left';
      state = { ...state, phase: 'walk', turnRemaining: 0 };
      emit();
    },
    getPayload: payload,
    stop(): void {
      clearInterval(timer);
    },
  };
}
