/**
 * 四边移动路径算法（TECH_DESIGN §7 路径抽象 / §8 转角处理 / PRD F001-F004）。
 * 纯函数模块：不依赖 Electron/DOM，可被 node --test 直接单测（编译进 dist/shared/）。
 * 坐标系：窗口左上角 (x, y)，DIP；PathRect = 窗口左上角合法范围（工作区扣掉窗口自身尺寸，
 * 解决 TECH_DESIGN §6 "避免恐龙一半被屏幕裁掉"）。
 */
import { WorkArea } from './geometry';

export type Edge = 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT';
/** 遍历方向：cw=顺时针(TOP→RIGHT→BOTTOM→LEFT)，ccw=逆时针(TOP→LEFT→BOTTOM→RIGHT) */
export type WalkDir = 'cw' | 'ccw';
export type MoveMode = 'clockwise' | 'counterclockwise' | 'random';
export type MovePhase = 'idle' | 'walk' | 'turn';
export type Facing = 'left' | 'right';

export interface PathRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 窗口左上角合法范围（T301「不越界」的几何定义） */
export function pathRect(area: WorkArea, winWidth: number, winHeight: number): PathRect {
  return {
    minX: area.x,
    minY: area.y,
    maxX: Math.max(area.x, area.x + area.width - winWidth),
    maxY: Math.max(area.y, area.y + area.height - winHeight),
  };
}

/** 顺时针序 TOP→RIGHT→BOTTOM→LEFT；逆时针反向（T302/T303） */
export function nextEdge(edge: Edge, dir: WalkDir): Edge {
  const order: Edge[] = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'];
  const i = order.indexOf(edge);
  return order[(i + (dir === 'cw' ? 1 : 3)) % 4];
}

/** 沿当前边按 dir 行进的终点角（TECH_DESIGN §7.1 四条线段） */
export function edgeEnd(edge: Edge, dir: WalkDir, r: PathRect): { x: number; y: number } {
  switch (edge) {
    case 'TOP':
      return { x: dir === 'cw' ? r.maxX : r.minX, y: r.minY };
    case 'RIGHT':
      return { x: r.maxX, y: dir === 'cw' ? r.maxY : r.minY };
    case 'BOTTOM':
      return { x: dir === 'cw' ? r.minX : r.maxX, y: r.maxY };
    case 'LEFT':
      return { x: r.minX, y: dir === 'cw' ? r.minY : r.maxY };
  }
}

/**
 * 边上朝向：横边=行进方向；竖边贴墙（RIGHT 边朝右、LEFT 边朝左），
 * 保证翻转素材后恐龙在四边都"面向它要去的方向"。
 */
export function facingOn(edge: Edge, dir: WalkDir): Facing {
  if (edge === 'TOP') {
    return dir === 'cw' ? 'right' : 'left';
  }
  if (edge === 'BOTTOM') {
    return dir === 'cw' ? 'left' : 'right';
  }
  return edge === 'RIGHT' ? 'right' : 'left';
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 将任意点投影到矩形周长上最近的一条边（Phase 6 拖动落位 / 点击移动目标共用）。
 * 先夹进合法范围，再取到四边距离最小者，返回该边上的投影点。
 */
export function nearestEdgePoint(
  x: number,
  y: number,
  r: PathRect,
): { edge: Edge; x: number; y: number } {
  const cx = clampNum(x, r.minX, r.maxX);
  const cy = clampNum(y, r.minY, r.maxY);
  const dTop = Math.abs(cy - r.minY);
  const dBottom = Math.abs(r.maxY - cy);
  const dLeft = Math.abs(cx - r.minX);
  const dRight = Math.abs(r.maxX - cx);
  const m = Math.min(dTop, dBottom, dLeft, dRight);
  if (m === dTop) {
    return { edge: 'TOP', x: cx, y: r.minY };
  }
  if (m === dBottom) {
    return { edge: 'BOTTOM', x: cx, y: r.maxY };
  }
  if (m === dLeft) {
    return { edge: 'LEFT', x: r.minX, y: cy };
  }
  return { edge: 'RIGHT', x: r.maxX, y: cy };
}

export interface MoveState {
  edge: Edge;
  dir: WalkDir;
  x: number;
  y: number;
  phase: MovePhase;
  /** turn 阶段剩余秒数 */
  turnRemaining: number;
  /** 本段自然速度系数（PRD F004：0.75~1.25） */
  speedFactor: number;
}

export interface StepOptions {
  rect: PathRect;
  /** 基础速度 px/s（WALK_BASE_SPEED） */
  baseSpeed: number;
  /** turn 停顿时长秒（TURN_DURATION_S） */
  turnDuration: number;
  mode: MoveMode;
  /** [0,1) 随机源，注入以便单测确定性（T304 random 转向/速度） */
  rng: () => number;
}

export interface StepEvents {
  phaseChanged: boolean;
  edgeChanged: boolean;
  facingChanged: boolean;
}

export function createMoveState(x: number, y: number, edge: Edge, dir: WalkDir): MoveState {
  return { edge, dir, x, y, phase: 'walk', turnRemaining: 0, speedFactor: 1 };
}

/**
 * 单步推进（§8 转角处理：WALK→TURN→改方向→WALK，禁止瞬移——
 * 到达角点精确落位后暂停 turnDuration 秒再切入下一边）。
 * random 模式：每个角点后随机决定新遍历方向（PRD F002）。
 */
export function stepMove(
  prev: MoveState,
  dt: number,
  o: StepOptions,
): { next: MoveState; events: StepEvents } {
  const s: MoveState = { ...prev };
  const events: StepEvents = { phaseChanged: false, edgeChanged: false, facingChanged: false };
  const beforeFacing = facingOn(prev.edge, prev.dir);

  // 退化路径（窗口 >= 工作区宽高）：钉在合法范围内不动，防拐角死循环
  if (o.rect.maxX === o.rect.minX && o.rect.maxY === o.rect.minY) {
    s.x = o.rect.minX;
    s.y = o.rect.minY;
    s.phase = 'idle';
    return { next: s, events };
  }

  if (s.phase === 'turn') {
    s.turnRemaining = Math.max(0, s.turnRemaining - dt);
    if (s.turnRemaining === 0) {
      s.phase = 'walk';
      s.speedFactor = 0.75 + o.rng() * 0.5; // 每段重新随机（F004）
      events.phaseChanged = true;
    }
    return { next: s, events };
  }
  if (s.phase !== 'walk' || dt <= 0) {
    return { next: s, events };
  }

  const end = edgeEnd(s.edge, s.dir, o.rect);
  const horizontal = s.edge === 'TOP' || s.edge === 'BOTTOM';
  const remaining = horizontal ? Math.abs(end.x - s.x) : Math.abs(end.y - s.y);
  const dist = o.baseSpeed * s.speedFactor * dt;

  if (dist >= remaining) {
    // 到达角点：精确落位 → 换边（random 模式掷骰换向）→ 进入 turn 停顿
    s.x = end.x;
    s.y = end.y;
    s.edge = nextEdge(s.edge, s.dir);
    if (o.mode === 'random') {
      s.dir = o.rng() < 0.5 ? 'cw' : 'ccw';
    }
    s.phase = 'turn';
    s.turnRemaining = o.turnDuration;
    events.edgeChanged = true;
    events.phaseChanged = true;
  } else if (horizontal) {
    s.x += Math.sign(end.x - s.x) * dist;
  } else {
    s.y += Math.sign(end.y - s.y) * dist;
  }

  events.facingChanged = facingOn(s.edge, s.dir) !== beforeFacing;
  return { next: s, events };
}
