/**
 * Renderer 入口（Phase 2 装配 + Phase 3 移动跟随 + Phase 4 状态机驱动）。
 * 职责：组装 AnimationEngine + SpriteSheet + DinoRenderer + GameLoop + DinoStateMachine；
 *       dev 资产调试面板（03 接入文档第八阶段：按钮播放各动画 + Animation/Frame/FPS/Direction 显示）；
 *       T103 命中检测（恐龙区 + 调试面板区）驱动 穿透/交互 模式切换。
 * 不负责：帧计时（AnimationEngine）、绘制（DinoRenderer）、状态切换决策（StateMachine）、窗口（main 进程）。
 * renderer 不直接访问 Node API，一切主进程能力经 window.dinoAPI（TECH_DESIGN §20）。
 */
import type { AnimationId } from './animation/AnimationDefinition.js';
import { ANIMATIONS, DINO_SOURCE_FACING } from './animation/AnimationManifest.js';
import { AnimationEngine } from './animation/AnimationEngine.js';
import { SpriteSheet } from './asset/SpriteSheet.js';
import { DinoRenderer } from './render/DinoRenderer.js';
import { createGameLoop } from './core/GameLoop.js';
import { DinoStateMachine, type StateOutput, type StateMachineInput, type PetState } from './state/StateMachine.js';
import { ActionQueue } from './state/ActionQueue.js';
import { EffectPlayer } from './effect/EffectPlayer.js';
import type { EffectName } from './effect/EffectManifest.js';

/* ------------------------------------------------------------------ */
/* 常量：与 src/shared/constants.ts 手工同步（sandbox+ESM 隔离，见 project_process.md §1-5） */
/* ------------------------------------------------------------------ */
const DINO_RENDER_SIZE = 96; // = shared DINO_RENDER_SIZE
const PET_WINDOW_SIZE = 128; // = shared PET_WINDOW_WIDTH/HEIGHT（stage 固定 128，dev 面板在右侧）
/** 命中区外扩（滞回），避免边界抖动导致模式来回切换 */
const HIT_HYSTERESIS = 8;

/** Phase 6 交互阈值：超过此位移视为拖动（非点击）；双击/连点时间窗；连点生气概率 */
const DRAG_THRESHOLD_PX = 4;
const DBL_WINDOW_MS = 280;
const CLICK_RESET_MS = 500;
const ANGRY_PROB = 0.35;

/** 需求扩展（与 shared ACTION_GAP_MS 同步）：拖完吐火×3 / 到达吐水×3 相邻动作间隔 */
const ACTION_GAP_MS = 180;

type InteractiveMode = 'passive' | 'interactive';
type Facing = 'left' | 'right';

interface PingResult {
  pong: boolean;
  version: string;
  isDev: boolean;
}

interface WindowInfo {
  bounds: { x: number; y: number; width: number; height: number } | null;
  workArea: { x: number; y: number; width: number; height: number };
  clickThroughMode: InteractiveMode;
  movement: MovementState | null;
}

/** Phase 3/6 移动状态（与 src/shared/movement.ts 手工同步，sandbox+ESM 隔离） */
interface MovementState {
  phase: 'idle' | 'walk' | 'turn';
  edge: 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT';
  facing: Facing;
  moving: boolean;
  activity: 'patrol' | 'target' | 'drag';
}

/** Phase 8 配置（与 src/shared/config-schema.ts 手工同步） */
interface DinoConfig {
  direction: 'clockwise' | 'counterclockwise' | 'random';
  speed: 'slow' | 'normal' | 'fast';
  behaviorEnabled: boolean;
  clickThrough: boolean;
  nightMode: boolean;
  autoStart: boolean;
  monitorId: string | null;
  /** 界面语言（与 shared/i18n Language 手工同步） */
  language: 'en' | 'zh';
}

/** Phase 8 显示器概要（与 main screen-manager DisplayInfo 手工同步） */
interface DisplayInfo {
  id: string;
  label: string;
  primary: boolean;
}

declare global {
  interface Window {
    dinoAPI: {
      ping: () => Promise<PingResult>;
      setInteractive: (active: boolean) => void;
      getWindowInfo: () => Promise<WindowInfo>;
      onMovementState: (cb: (state: MovementState) => void) => () => void;
      setMovement: (opts: {
        enabled?: boolean;
        mode?: string;
        dragStart?: { x: number; y: number };
        dragEnd?: boolean;
        moveTo?: { x: number; y: number };
        runAway?: boolean;
      }) => void;
      onBehavior: (cb: (enabled: boolean) => void) => () => void;
      /** 需求扩展：订阅"到达目标点"一次性事件（触发吐水队列） */
      onArrived: (cb: () => void) => () => void;
      getConfig: () => Promise<DinoConfig | null>;
      setConfig: (partial: Partial<DinoConfig>) => Promise<DinoConfig | null>;
      onConfig: (cb: (cfg: DinoConfig) => void) => () => void;
      getDisplays: () => Promise<DisplayInfo[]>;
    };
  }
}

/* ------------------------------------------------------------------ */
/* 渲染装配：引擎 + 精灵缓存 + 画布绘制 + 主循环 */
/* ------------------------------------------------------------------ */
const engine = new AnimationEngine();
const renderer = new DinoRenderer(
  document.getElementById('dino-canvas') as HTMLCanvasElement,
  PET_WINDOW_SIZE,
);
/** Phase 5：特效层（与主体解耦，叠加在恐龙之上） */
const effects = new EffectPlayer();
/** 仅正式素材建 SpriteSheet；placeholder 动画直接程序占位绘制（T202 显式标识） */
const sheets = new Map<AnimationId, SpriteSheet>();
let facing: Facing = DINO_SOURCE_FACING;

/* Phase 3：主进程移动状态提供相位/朝向输入；Phase 4：状态机据相位+随机行为驱动动画（单一真相源） */
let movementState: MovementState | null = null;
let manualOverride = false; // dev 面板点播优先，直到该动画播完或下个 movement 相位变化交还状态机
const MOVE_MODES = ['clockwise', 'counterclockwise', 'random'] as const;
let moveMode: (typeof MOVE_MODES)[number] = 'clockwise';

/* 移动开关（用户意图）与状态机动作暂停门控：实际 enabled = moveIntent && actionMoveEnabled */
let moveIntent = true;
let actionMoveEnabled = true;
let lastSentEnabled: boolean | null = null;
let lastAppliedAnim: AnimationId | null = null;
let lastPetState: PetState | null = null;

// 按需重绘门控（Phase 10 性能）：记录上次整面绘制的场景签名，主体帧/朝向/活动特效未变则跳过 clear+draw，
// 避免对 transparent+alwaysOnTop 分层窗口以 rAF 满帧重绘刷爆合成器瓦片（canvas 自保留上一帧完整合成）
let lastDrawId: AnimationId = 'idle';
let lastDrawFrame = -1;
let lastDrawFlipped = false;
let lastDrawEffectsActive = false;
let needsRedraw = true; // 首帧强制绘制

// movePhase 绑定移动意图：动作自停会触发 main 的 idle 回声，用意图判断避免误切 IDLE；转角仍由 turn 相位驱动
// Phase 6：拖动/目标期间以引擎 activity 的相位为准（到达后 idle 停顿不回落基态）
const stateMachine = new DinoStateMachine({
  movePhase: () => {
    const ph = movementState?.phase ?? 'idle';
    const act = movementState?.activity ?? 'patrol';
    if (act !== 'patrol') {
      return ph;
    }
    return moveIntent ? ph : 'idle';
  },
});

function applyMovementState(s: MovementState): void {
  const phaseChanged = !movementState || movementState.phase !== s.phase;
  movementState = s;
  facing = s.facing;
  if (phaseChanged) {
    manualOverride = false; // 交还状态机驱动权
  }
  // 需求扩展④：队列动作(吏水/喷火)播放中，引擎收到“重新走向新目标”（左键点哪走哪、追击最新点击）
  // → 中断旧队列、交还行走动画（否则引擎在 activity='target' 下会带着喷射动画滑屏）
  if (queueActive && s.activity === 'target' && s.phase === 'walk') {
    interruptQueue();
  }
  // 需求扩展③：拖完松手的喷火×3 延迟到“拖动态已结束”回声到达后入队
  //（dragEnd 为异步 IPC，若在 activity 仍为 'drag' 时入队会被 playQueuedAction 守卫/tick 的 DRAGGED 抢占吞掉）
  if (pendingFireAfterDrag && s.activity !== 'drag') {
    pendingFireAfterDrag = false;
    enqueueActions(['FIRE', 'FIRE', 'FIRE']);
  }
  syncControlButtons();
}

function syncMovementEnabled(): void {
  const enabled = moveIntent && actionMoveEnabled;
  if (enabled === lastSentEnabled) {
    return; // 幂等：仅变化时发 IPC（SKILL §23）
  }
  lastSentEnabled = enabled;
  window.dinoAPI.setMovement({ enabled });
}

/** 状态机输出 → 副作用：切动画（enter 语义，仅变化时）+ 移动门控 + 面板高亮 + 特效触发 */
function applyStateOutput(out: StateOutput): void {
  actionMoveEnabled = out.moveEnabled;
  if (out.animation !== lastAppliedAnim) {
    lastAppliedAnim = out.animation;
    engine.setAnimation(out.animation);
    markActive(out.animation);
  }
  if (out.state !== lastPetState) {
    syncEffectsForState(out.state, lastPetState);
    lastPetState = out.state;
  }
  syncMovementEnabled();
}

/* Phase 5：状态迁移 → 特效生成（app 编排，主体/特效解耦）
 * 注：FIRE/WATER 不叠加 effects 弹体——素材为一体化“口腔内起喷”帧（master prompt §6 最高验收，
 * 2026-09-29 更新帧已明确画出下颌开合+口内喷射），再贴独立弹体会形成双火焰、违背 §6“不得以特效替代主体喷射”。 */
function syncEffectsForState(next: PetState, prev: PetState | null): void {
  switch (next) {
    case 'JUMP':
      effects.spawn('dust');
      break;
    case 'REACTION':
      effects.spawn('sparkle');
      break;
    case 'SLEEP':
      effects.spawn('zzz'); // loop 幂等，持续到离开 SLEEP
      break;
  }
  if (prev === 'SLEEP' && next !== 'SLEEP') {
    effects.cancel('zzz');
  }
}

/** 绘制本帧特效叠加层（在 drawCurrent 之后，不清屏） */
function drawEffects(): void {
  const fl = isFlipped();
  for (const item of effects.current()) {
    const r = item.renderable;
    const opts = {
      anchor: r.def.anchor,
      size: r.def.size,
      travel: r.def.travel,
      progress: r.progress,
      flipped: fl,
      alpha: r.alpha,
    };
    if (r.def.kind === 'text') {
      renderer.drawEffectText(r.def.text ?? '', opts);
    } else {
      renderer.drawEffect(item.img, opts);
    }
  }
}

function isFlipped(): boolean {
  return facing !== DINO_SOURCE_FACING;
}

function drawCurrent(): void {
  const def = engine.def;
  if (def.placeholder) {
    renderer.drawPlaceholder(def.id);
    return;
  }
  const sheet = sheets.get(def.id);
  const img = sheet ? sheet.get(engine.frame) : null;
  // img=null（加载中/失败）时回退占位绘制并标注，不空白（SKILL §27）
  renderer.drawFrame(img, isFlipped(), `${def.id} (asset load failed)`);
}

/* HUD：仅在显示值变化时写 DOM，不做每帧字符串拼接 */
let hudEl: HTMLElement | null = null;
let lastHud = '';
function refreshHud(): void {
  if (!hudEl) {
    return;
  }
  const def = engine.def;
  const frameText = def.placeholder
    ? `PLACEHOLDER (${def.frames}f)`
    : `${engine.frame + 1}/${def.frames}`;
  const text = `Anim: ${def.id}${def.placeholder ? ' [placeholder]' : ''}\n` +
    `Frame: ${frameText}\n` +
    `FPS: ${def.fps}\n` +
    `Dir: ${facing}${isFlipped() ? ' (flipped)' : ''}\n` +
    `State: ${stateMachine.getState()}${manualOverride ? ' [manual]' : ''}\n` +
    (movementState
      ? `Move: ${movementState.edge}/${movementState.phase}${movementState.activity !== 'patrol' ? `/${movementState.activity}` : ''}${(moveIntent && actionMoveEnabled) ? '' : ' [paused]'}`
      : 'Move: -');
  if (text !== lastHud) {
    lastHud = text;
    hudEl.textContent = text;
  }
}

const loop = createGameLoop((dt) => {
  // Phase 4：状态机以真实 dt 每帧推进（随机行为判定/冷却/SLEEP 计时）；
  // manualOverride（dev 点播）期间冻结状态机，交还驱动权后恢复
  if (!manualOverride) {
    applyStateOutput(stateMachine.tick(dt, currentInput()));
  }
  engine.update(dt);
  // Phase 5：特效推进（一次性特效播完自动销毁，不残留）
  effects.update(dt);
  // 按需重绘：主体动画/帧号/朝向变化、有活动特效（特效逐帧动画需刷新）、或特效刚结束需清除叠加，
  // 才整面 clear+draw主体与叠加；否则跳过重绘（窗口位移由主进程 move，与此无关）
  const flipped = isFlipped();
  const effectsActive = effects.hasActive();
  if (
    needsRedraw ||
    engine.id !== lastDrawId ||
    engine.frame !== lastDrawFrame ||
    flipped !== lastDrawFlipped ||
    effectsActive ||
    effectsActive !== lastDrawEffectsActive
  ) {
    drawCurrent();
    drawEffects();
    lastDrawId = engine.id;
    lastDrawFrame = engine.frame;
    lastDrawFlipped = flipped;
    lastDrawEffectsActive = effectsActive;
    needsRedraw = false;
  }
  refreshHud();
});

// one-shot 动画播完：dev 预览则交还驱动权；队列动作则接下一个/收尾；自然行为则通知状态机结束并恢复移动
engine.onFinished = () => {
  if (manualOverride) {
    manualOverride = false;
    return;
  }
  if (onQueuedActionFinished()) {
    return;
  }
  applyStateOutput(stateMachine.finishAction());
};

/* ------------------------------------------------------------------ */
/* T103：命中检测（恐龙本体区 + dev 调试面板区）+ 穿透/交互模式切换 */
/* ------------------------------------------------------------------ */
function hitDino(x: number, y: number, expanded: boolean): boolean {
  const pad = HIT_HYSTERESIS * (expanded ? 1 : 0);
  const half = DINO_RENDER_SIZE / 2 + pad;
  const cx = PET_WINDOW_SIZE / 2;
  const cy = PET_WINDOW_SIZE / 2;
  return x >= cx - half && x <= cx + half && y >= cy - half && y <= cy + half;
}

function createModeController(panelEl: HTMLElement | null, debugEl: HTMLElement | null) {
  let mode: InteractiveMode = 'passive';

  function set(next: InteractiveMode): void {
    if (next === mode) {
      return; // 幂等，避免高频 IPC（SKILL §23：IPC 只在必要事件时调用）
    }
    mode = next;
    window.dinoAPI.setInteractive(next === 'interactive');
    if (debugEl) {
      void refreshDebug(debugEl);
    }
  }

  function hitPanel(x: number, y: number): boolean {
    if (!panelEl || panelEl.classList.contains('hidden')) {
      return false;
    }
    const r = panelEl.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  return {
    onPointerMove(x: number, y: number): void {
      // 进入用标准命中区，退出用外扩区（滞回防抖）
      if (mode === 'passive') {
        if (hitDino(x, y, false) || hitPanel(x, y)) {
          set('interactive');
        }
      } else if (!hitDino(x, y, true) && !hitPanel(x, y)) {
        set('passive');
      }
    },
    onPointerLeave(): void {
      if (mode === 'interactive') {
        set('passive');
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Phase 6：鼠标交互（拖动 / 点击移动 / 单击·双击·连点反应） */
/* 拖动与目标以主进程引擎 activity 为真相源（拖动由主进程轮询光标接管，避免 renderer 事件丢失） */
/* ------------------------------------------------------------------ */
let canvasEl: HTMLCanvasElement | null = null;
let modeCtl: { onPointerMove: (x: number, y: number) => void; onPointerLeave: () => void } | null = null;
let pointerDown = false;
let dragStarted = false;
let downX = 0;
let downY = 0;
let hoveringDino = false;
let clickCount = 0;
let lastClickT = 0;
let clickTimer: number | null = null;
let behaviorEnabled = true; // Phase 7 托盘：随机行为启/禁（IPC 下发）

/** 供状态机每帧读取的交互输入（拖动/目标以引擎 activity 为准，悬停=交互中）。
 * 需求扩展：队列动作播放期间（queueActive）压制 movingToTarget，避免到达后的 MOVE_TO_TARGET 抢占吐水；
 * 并将队列视同“交互中”，屏蔽随机行为干扰。 */
function currentInput(): StateMachineInput {
  const act = movementState?.activity ?? 'patrol';
  return {
    userInteracting: hoveringDino || act === 'drag' || queueActive,
    dragging: act === 'drag',
    movingToTarget: act === 'target' && !queueActive,
    behaviorEnabled,
  };
}

function triggerAction(state: PetState): void {
  applyStateOutput(stateMachine.trigger(state));
}

/* ------------------------------------------------------------------ */
/* 需求扩展：一次性动作队列（拖完喷火×3 / 到达吐水×3，相邻短间隔，新触发清空旧队列） */
/* ------------------------------------------------------------------ */
const actionQueue = new ActionQueue();
let queueActive = false;
let queueGapTimer: number | null = null;
/** 需求扩展③：拖完松手后，待主进程“拖动态结束”回声到达再入队喷火（避开 DRAGGED 抢占） */
let pendingFireAfterDrag = false;

/** 排入一组动作：清空旧队列（新交互打断旧的），立即播第一个。 */
function enqueueActions(states: readonly PetState[]): void {
  if (queueGapTimer !== null) {
    window.clearTimeout(queueGapTimer);
    queueGapTimer = null;
  }
  const first = actionQueue.start(states);
  if (first) {
    playQueuedAction(first);
  } else {
    queueActive = false;
  }
}

/** 播队列中一个动作：让状态机进入该 SPECIAL（暂停移动），并强制重播动画
 *  （绕过 applyStateOutput 的“同动画不重设”门控——引擎在 finished 时同名 setAnimation 会从第 0 帧复位）。 */
function playQueuedAction(state: PetState): void {
  // 队列播放中途被新拖动打断：放弃未完成队列（下一次拖完会经 pendingFireAfterDrag 重新触发）
  if (movementState?.activity === 'drag') {
    queueActive = false;
    actionQueue.clear();
    return;
  }
  queueActive = true;
  const out = stateMachine.trigger(state);
  actionMoveEnabled = out.moveEnabled; // SPECIAL ⇒ false
  engine.setAnimation(out.animation); // 引擎已播完(finished)则同名也会复位重播
  lastAppliedAnim = out.animation;
  markActive(out.animation);
  if (out.state !== lastPetState) {
    syncEffectsForState(out.state, lastPetState);
    lastPetState = out.state;
  }
  syncMovementEnabled();
}

/** one-shot 动画播完回调的队列分支：还有下一个则间隔后接续；否则收尾交还状态机。
 * 返回 true 表示本次完成由队列接管（上层不再走 finishAction）。 */
function onQueuedActionFinished(): boolean {
  if (!queueActive) {
    return false;
  }
  if (actionQueue.pending > 0) {
    queueGapTimer = window.setTimeout(() => {
      queueGapTimer = null;
      const nxt = actionQueue.next();
      if (nxt) {
        playQueuedAction(nxt);
      } else {
        queueActive = false;
      }
    }, ACTION_GAP_MS);
  } else {
    queueActive = false;
    applyStateOutput(stateMachine.finishAction());
  }
  return true;
}

/** 中断正在播放的动作队列（新的左键指路点击“追击最新、放弃之前的”）：清空队列并交还行走驱动权。 */
function interruptQueue(): void {
  if (queueGapTimer !== null) {
    window.clearTimeout(queueGapTimer);
    queueGapTimer = null;
  }
  actionQueue.clear();
  if (queueActive) {
    queueActive = false;
    applyStateOutput(stateMachine.finishAction());
  }
}

function endDragIfNeeded(): void {
  if (dragStarted) {
    dragStarted = false;
    window.dinoAPI.setMovement({ dragEnd: true });
    // 需求扩展③：拖完松手 → 喷火×3，但延迟到主进程“拖动态结束”回声到达后入队
    //（此刻 movementState.activity 仍为 'drag'，直接入队会被守卫/tick DRAGGED 抢占吞掉）
    pendingFireAfterDrag = true;
  }
}

function onPointerMove(x: number, y: number): void {
  hoveringDino = hitDino(x, y, true);
  modeCtl?.onPointerMove(x, y);
  if (canvasEl) {
    canvasEl.style.cursor = dragStarted ? 'grabbing' : hoveringDino ? 'grab' : 'default';
  }
  if (pointerDown && !dragStarted) {
    const dx = x - downX;
    const dy = y - downY;
    if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      dragStarted = true;
      // 需求扩展：开始新拖动 → 立即放弃正在播放的动作队列（新交互打断旧的）
      if (queueGapTimer !== null) {
        window.clearTimeout(queueGapTimer);
        queueGapTimer = null;
      }
      actionQueue.clear();
      queueActive = false;
      // 抓取点相对窗口内容坐标（CSS px = DIP），主进程按 光标-偏移 移动窗口，无跳变
      window.dinoAPI.setMovement({ dragStart: { x: downX, y: downY } });
    }
  }
}

function onPointerDown(x: number, y: number): void {
  if (!hitDino(x, y, false)) {
    return; // 仅恐龙本体可拖/点
  }
  pointerDown = true;
  dragStarted = false;
  downX = x;
  downY = y;
}

function onPointerUp(): void {
  if (!pointerDown) {
    return;
  }
  pointerDown = false;
  if (dragStarted) {
    endDragIfNeeded();
    return; // 拖动结束不算点击
  }
  registerClick();
}

/** 单击/双击/连点分类：单→REACTION，双→跑开(MOVE_TO_TARGET)，连点→低概率生气吐火（PRD F008） */
function registerClick(): void {
  const now = performance.now();
  if (now - lastClickT > CLICK_RESET_MS) {
    clickCount = 0;
  }
  lastClickT = now;
  clickCount += 1;

  if (clickCount >= 3) {
    clickCount = 0;
    triggerAction(Math.random() < ANGRY_PROB ? 'FIRE' : 'REACTION');
    return;
  }
  if (clickTimer !== null) {
    // 时间窗内第二次 → 双击：取消单击待命，随机跑开
    window.clearTimeout(clickTimer);
    clickTimer = null;
    clickCount = 0;
    window.dinoAPI.setMovement({ runAway: true });
    return;
  }
  // 待命：若 DBL_WINDOW 内无第二次点击则判为单击
  clickTimer = window.setTimeout(() => {
    clickTimer = null;
    triggerAction('REACTION');
  }, DBL_WINDOW_MS);
}

/* ------------------------------------------------------------------ */
/* SKILL §30 调试浮层（仅 dev；事件驱动更新，无轮询、无每帧日志） */
/* ------------------------------------------------------------------ */
async function refreshDebug(debugEl: HTMLElement): Promise<void> {
  try {
    const info = await window.dinoAPI.getWindowInfo();
    const b = info.bounds;
    debugEl.textContent =
      `Mode: ${info.clickThroughMode}\n` +
      `Win: ${b ? `${b.x},${b.y} ${b.width}x${b.height}` : '-'}\n` +
      `WorkArea: ${info.workArea.x},${info.workArea.y} ${info.workArea.width}x${info.workArea.height}\n` +
      `DPR: ${window.devicePixelRatio}`;
  } catch (err) {
    console.error('[ERROR] getWindowInfo failed:', err);
  }
}

/* ------------------------------------------------------------------ */
/* dev 资产调试面板（03 接入文档第八阶段验收：每动画一按钮 + 方向切换） */
/* ------------------------------------------------------------------ */
const activeButtons = new Map<AnimationId, HTMLButtonElement>();

/** dev 面板点播时的特效预览：动画 id → 特效名（无映射则收回 zzz）
 *  fire/water 由一体化角色帧自带喷射，不叠加口部特效（master prompt §6）。 */
const EFFECT_OF_ANIM: Partial<Record<AnimationId, EffectName>> = {
  jump: 'dust',
  reaction: 'sparkle',
  sleep: 'zzz',
};
function previewEffect(id: AnimationId): void {
  effects.cancel('zzz');
  const e = EFFECT_OF_ANIM[id];
  if (e) {
    effects.spawn(e);
  }
}

function markActive(id: AnimationId): void {
  for (const [key, btn] of activeButtons) {
    btn.classList.toggle('active', key === id);
  }
}

function buildDebugPanel(): void {
  const panel = document.getElementById('debug-panel');
  const grid = document.getElementById('anim-buttons');
  const dirBtn = document.getElementById('btn-direction');
  if (!panel || !(grid instanceof HTMLElement) || !(dirBtn instanceof HTMLButtonElement) || !hudEl) {
    return;
  }
  panel.classList.remove('hidden');
  hudEl.classList.remove('hidden');

  for (const id of Object.keys(ANIMATIONS) as AnimationId[]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = ANIMATIONS[id].placeholder ? `${id}*` : id;
    btn.title = ANIMATIONS[id].placeholder ? `${id} (placeholder 素材未到位)` : `${id} ${ANIMATIONS[id].frames}f @ ${ANIMATIONS[id].fps}fps`;
    btn.addEventListener('click', () => {
      manualOverride = true; // 点播优先（冻结状态机），one-shot 播完或下个相位变化时交还
      lastAppliedAnim = id; // 防止交还前最后一帧被状态机覆盖
      engine.setAnimation(id); // 同动画播放中幂等；已结束/不同则重播
      previewEffect(id);
      markActive(id);
    });
    grid.appendChild(btn);
    activeButtons.set(id, btn);
  }
  markActive(engine.id);

  dirBtn.addEventListener('click', () => {
    manualOverride = true;
    facing = facing === 'left' ? 'right' : 'left';
    dirBtn.textContent = `Dir: ${facing === 'left' ? 'Left' : 'Right'}`;
  });
  syncControlButtons();
}

/** Move/Mode 按钮状态回显（dev 面板）；Move 显示用户意图 moveIntent（非动作暂停后的实际 moving） */
function syncControlButtons(): void {
  const moveBtn = document.getElementById('btn-move');
  const modeBtn = document.getElementById('btn-mode');
  if (moveBtn instanceof HTMLButtonElement) {
    moveBtn.textContent = `Move: ${moveIntent ? 'On' : 'Off'}`;
    moveBtn.classList.toggle('active', moveIntent);
  }
  if (modeBtn instanceof HTMLButtonElement) {
    modeBtn.textContent =
      moveMode === 'clockwise' ? 'Mode: CW' : moveMode === 'counterclockwise' ? 'Mode: CCW' : 'Mode: Rand';
  }
}

function bindControlButtons(): void {
  const moveBtn = document.getElementById('btn-move');
  const modeBtn = document.getElementById('btn-mode');
  if (moveBtn instanceof HTMLButtonElement) {
    moveBtn.addEventListener('click', () => {
      moveIntent = !moveIntent; // 用户意图开关；实际下发经 syncMovementEnabled 与动作门控合并
      syncMovementEnabled();
      syncControlButtons();
    });
  }
  if (modeBtn instanceof HTMLButtonElement) {
    modeBtn.addEventListener('click', () => {
      const i = MOVE_MODES.indexOf(moveMode);
      moveMode = MOVE_MODES[(i + 1) % MOVE_MODES.length];
      window.dinoAPI.setMovement({ mode: moveMode });
      syncControlButtons();
    });
  }
}

/* ------------------------------------------------------------------ */
/* 启动 */
/* ------------------------------------------------------------------ */
async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('dino-canvas');
  const errorEl = document.getElementById('fatal-error');
  const debugEl = document.getElementById('debug-overlay');
  hudEl = document.getElementById('anim-hud');
  if (!(canvas instanceof HTMLCanvasElement) || !hudEl) {
    console.error('[ERROR] renderer DOM skeleton missing');
    return;
  }

  // 正式素材一次性预加载（占位动画不建 sheet）
  const jobs: Promise<unknown>[] = [];
  for (const id of Object.keys(ANIMATIONS) as AnimationId[]) {
    const def = ANIMATIONS[id];
    if (def.placeholder) {
      continue;
    }
    const sheet = new SpriteSheet(def.dir, def.frames);
    sheets.set(id, sheet);
    jobs.push(sheet.preload().then((ok) => ok || id));
  }

  try {
    const result = await window.dinoAPI.ping();
    if (result.isDev && debugEl) {
      debugEl.classList.remove('hidden');
      buildDebugPanel();
      await refreshDebug(debugEl);
    }
  } catch (err) {
    // 不空 catch：可见 fallback + 日志（SKILL §27）
    console.error('[ERROR] dinoAPI.ping failed:', err);
    if (errorEl) {
      errorEl.textContent = 'IPC 链路不可用';
      errorEl.classList.remove('hidden');
    }
  }

  const failed = (await Promise.all(jobs)).filter((r) => r !== true);
  if (failed.length > 0) {
    console.error(`[ERROR] sprite preload failed: ${failed.join(', ')}`);
  } else {
    console.log(`[INFO] sprites preloaded: ${sheets.size} animations`);
  }

  // Phase 5：特效帧预加载（effects/ 为可选装饰层，失败不阻断启动，仅降级无特效）
  const effectFailed = await effects.preload();
  if (effectFailed.length > 0) {
    console.warn(`[WARN] effect preload failed: ${effectFailed.join(', ')}`);
  } else {
    console.log('[INFO] effects preloaded');
  }

  // Phase 3：订阅移动状态（先注册再拉当前态，避免引擎初始推送早于页面加载的窗口丢失）
  window.dinoAPI.onMovementState(applyMovementState);
  // Phase 7：订阅托盘行为开关
  window.dinoAPI.onBehavior((enabled) => {
    behaviorEnabled = enabled;
  });
  // 需求扩展：到达目标点 → 吐水×3（含短间隔）
  window.dinoAPI.onArrived(() => {
    enqueueActions(['WATER', 'WATER', 'WATER']);
  });
  bindControlButtons();
  try {
    const info = await window.dinoAPI.getWindowInfo();
    if (info.movement) {
      applyMovementState(info.movement);
    }
  } catch (err) {
    console.error('[ERROR] initial getWindowInfo failed:', err);
  }

  const controller = createModeController(
    document.getElementById('debug-panel'),
    debugEl,
  );
  canvasEl = canvas;
  modeCtl = controller;
  window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      onPointerDown(e.clientX, e.clientY);
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      onPointerUp();
    }
  });
  // 失焦安全：防止拖动中鼠标移出窗口未捕获 mouseup 导致卡在拖动态
  window.addEventListener('blur', () => {
    pointerDown = false;
    endDragIfNeeded();
  });
  document.addEventListener('mouseleave', () => {
    hoveringDino = false;
    controller.onPointerLeave();
  });

  // DPI 变化由 beginFrame 每帧处理（SKILL §25），无需 resize 监听重绘静态图
  // 启动即由状态机驱动一次（避免循环首帧前的空窗）：初始基态 WALK
  applyStateOutput(stateMachine.tick(0, currentInput()));
  loop.start();
}

void bootstrap();

export {};
