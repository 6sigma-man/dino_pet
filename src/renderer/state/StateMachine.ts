/**
 * 行为状态机（Phase 4：T401 状态与转换 / T402 转角 turn / T403 BehaviorSelector）。
 * 纯函数模块：不依赖 DOM/Electron/AnimationEngine，可单测（tsconfig.unittest 编进 dist-unittest/）。
 * 设计对应：
 * - TECH_DESIGN §10：状态 = 有限集合，转换有明确入口出口；enter/exit 语义由 app.ts 在
 *   输出变化时执行（enter=切动画+暂停移动，exit=恢复移动）。
 * - TECH_DESIGN §11 优先级：USER_INTERACTION(暂停/拖动) > SPECIAL_ACTION > 移动基态(IDLE/WALK/TURN)。
 *   特殊动作播放期间移动 phase 输入不抢占，动作结束交还驱动权——天然满足"用户操作高于随机"。
 * - TECH_DESIGN §12/§13 + PRD §7：BehaviorSelector 集中在本模块（权重表 + 全局/单动作冷却 +
 *   连续同动作上限），禁止随机判定散落各层。
 * - DRAGGED / MOVE_TO_TARGET 属于 Phase 6 用户交互，本阶段仅在优先级判定中预留插桩点（paused 输入）。
 * - RUN 状态合法但暂无自然入口（random 表按 PRD §7 不含奔跑），留给速度档位（Phase 8）与交互驱动。
 */

export type PetState =
  | 'IDLE'
  | 'WALK'
  | 'RUN'
  | 'TURN'
  | 'FIRE'
  | 'WATER'
  | 'TAIL'
  | 'JUMP'
  | 'SLEEP'
  | 'REACTION'
  | 'DRAGGED'
  | 'MOVE_TO_TARGET';

/** 移动引擎输入相位（与 shared/movement.ts MovePhase 手工同步，单测模块零跨目录依赖） */
export type MovePhaseInput = 'idle' | 'walk' | 'turn';

export type BehaviorAction = 'TAIL' | 'FIRE' | 'WATER' | 'JUMP';

/** 一次性特殊动作（播放期间暂停移动，onFinished 后回基态） */
const SPECIAL: ReadonlySet<PetState> = new Set<PetState>(['FIRE', 'WATER', 'TAIL', 'JUMP', 'REACTION']);

export interface BehaviorDef {
  state: BehaviorAction;
  /** 权重（PRD §7 建议值折算：tail 8 / fire 7 / water 5 / jump 3；发呆走独立通道） */
  weight: number;
  /** 该动作自身的冷却秒数（TECH_DESIGN §13） */
  cooldown: number;
}

export interface BehaviorOptions {
  /** 行为权重表；null = 关闭随机行为（T401 纯移动回归） */
  actions: readonly BehaviorDef[] | null;
  /** 判定间隔秒（每个窗口最多掷一次，防连发） */
  rollInterval: number;
  /** 窗口内触发行为的概率（PRD §7 正常走 60% → 0.4） */
  triggerChance: number;
  /** 全局冷却：任意动作结束后 N 秒内不再触发新动作（§13 防连刷） */
  globalCooldown: number;
  /** 同一动作最多连续触发次数（PRD §7：不允许无限重复） */
  maxRepeat: number;
  /** SLEEP 自动唤醒秒数 */
  sleepDuration: number;
  /** 行走多久后可能入睡（PRD §7 "其他/发呆" 独立通道） */
  baseSleepAfter: number;
  rng: () => number;
}

export interface StateMachineInput {
  /** 用户交互中（拖动/悬停/点击）：禁止随机行为并可唤醒睡眠（PRD §7） */
  userInteracting?: boolean;
  /** Phase 6：正在拖动（最高优先级，打断一切） */
  dragging?: boolean;
  /** Phase 6：移动引擎正走向目标点（优先级高于特殊动作） */
  movingToTarget?: boolean;
  /** Phase 7：托盘开关——false 时禁用随机行为（仅基态行走/待机），默认 true */
  behaviorEnabled?: boolean;
}

export interface StateOutput {
  state: PetState;
  /** 目标动画；app.ts 仅在变化时 setAnimation（enter 语义） */
  animation: 'idle' | 'walk' | 'run' | 'turn' | 'fire' | 'water' | 'tail' | 'jump' | 'sleep' | 'reaction';
  /** 是否请求恢复移动（特殊动作/SLEEP 期间为 false，结束回基态时 true） */
  moveEnabled: boolean;
  /** 状态发生迁移（app 可据此交还朝向驱动权） */
  changed: boolean;
}

export interface StateMachineOptions {
  /** 覆盖默认行为表（单测注入确定性配置） */
  behavior?: Partial<BehaviorOptions>;
  /** 移动相位来源（默认 'walk'，app.ts 注入 movementState.phase） */
  movePhase?: () => MovePhaseInput;
}

const DEFAULT_BEHAVIOR: BehaviorOptions = {
  actions: [
    { state: 'TAIL', weight: 8, cooldown: 10 },
    { state: 'FIRE', weight: 7, cooldown: 20 },
    { state: 'WATER', weight: 5, cooldown: 20 },
    { state: 'JUMP', weight: 3, cooldown: 15 },
  ],
  rollInterval: 6,
  triggerChance: 0.4,
  globalCooldown: 5,
  maxRepeat: 2,
  sleepDuration: 20,
  baseSleepAfter: 90,
  rng: Math.random,
};

/** state → 动画映射（T401 全状态有明确动画出口；RUN 暂用 walk 帧，速度区分属 Phase 8/10） */
const ANIM_OF: Record<PetState, StateOutput['animation']> = {
  IDLE: 'idle',
  WALK: 'walk',
  RUN: 'walk',
  TURN: 'turn',
  FIRE: 'fire',
  WATER: 'water',
  TAIL: 'tail',
  JUMP: 'jump',
  SLEEP: 'sleep',
  REACTION: 'reaction',
  DRAGGED: 'idle', // 无专用拖拽动画，被携带时呈静态 idle（诚实占位）
  MOVE_TO_TARGET: 'walk',
};

export class DinoStateMachine {
  private readonly opt: BehaviorOptions;
  private readonly movePhaseOf: () => MovePhaseInput;
  private state: PetState = 'WALK';
  /** 距下次行为判定的时间窗 */
  private rollAt: number;
  /** 距允许下次动作的全局冷却 */
  private globalCd = 0;
  /** 各动作独立冷却剩余 */
  private cooldowns = new Map<BehaviorAction, number>();
  /** 连续同动作计数（maxRepeat 后该动作被过滤） */
  private lastAction: PetState | null = null;
  private repeatCount = 0;
  /** 累计行走时长（入睡判定） */
  private walkTime = 0;
  /** SLEEP 已睡时长 */
  private sleptFor = 0;

  constructor(opts: StateMachineOptions = {}) {
    this.opt = { ...DEFAULT_BEHAVIOR, ...opts.behavior };
    this.movePhaseOf = opts.movePhase ?? (() => 'walk');
    this.rollAt = this.opt.rollInterval;
  }

  getState(): PetState {
    return this.state;
  }

  /**
   * 每帧推进（app GameLoop 以真实 dt 调用；输入事件也调用一次 dt=0 刷新输出）。
   * 相位来源 movePhase 由构造注入（app 侧绑定移动意图，单测侧绑定固定值）。
   * 转换表（入口→出口）：
   *   基态 WALK/IDLE/TURN ← movement 相位；WALK --roll--> 特殊动作/SLEEP；
   *   特殊动作 --onFinished/超时--> 回基态；SLEEP --定时/交互/手动--> WALK。
   */
  tick(dt: number, input: StateMachineInput): StateOutput {
    const prev = this.state;
    if (dt > 0) {
      this.globalCd = Math.max(0, this.globalCd - dt);
    }
    if (input.userInteracting) {
      this.rollAt = this.opt.rollInterval; // 交互期间不掷骰（PRD §7）
    }
    for (const [k, v] of this.cooldowns) {
      if (v > 0) {
        this.cooldowns.set(k, Math.max(0, v - dt));
      }
    }

    // §11 最高优先级：拖动 > 走向目标 > 特殊动作。两者都打断一切（含特殊动作播放）。
    if (input.dragging) {
      this.state = 'DRAGGED';
      this.sleptFor = 0;
      return { state: 'DRAGGED', animation: 'idle', moveEnabled: false, changed: prev !== 'DRAGGED' };
    }
    if (input.movingToTarget) {
      // 走向目标用 walk；到达后引擎回 idle 相位 → 短暂停顿用 idle（PRD F007）
      const anim: StateOutput['animation'] = this.movePhaseOf() === 'idle' ? 'idle' : 'walk';
      this.state = 'MOVE_TO_TARGET';
      this.sleptFor = 0;
      return { state: 'MOVE_TO_TARGET', animation: anim, moveEnabled: true, changed: prev !== 'MOVE_TO_TARGET' };
    }

    if (SPECIAL.has(this.state)) {
      // 特殊动作播放期间不被 movement 抢占；结束由 finishAction() 显式触发
      // （one-shot 动画走 AnimationEngine.onFinished；此处兜底超时防回调丢失卡死）
      this.sleptFor += dt;
      if (this.sleptFor > 10) {
        this.resumeBase();
      }
    } else if (this.state === 'SLEEP') {
      this.sleptFor += dt;
      if (this.sleptFor >= this.opt.sleepDuration || input.userInteracting) {
        this.resumeBase(); // 定时自然醒 / 用户唤醒（PRD §7 睡眠可被唤醒）
      }
    } else {
      // 基态：IDLE/WALK/TURN，跟随 movement 相位；TURN 优先（T402 转角）
      const phase = this.movePhaseOf();
      if (phase === 'turn') {
        this.state = 'TURN';
      } else if (this.state === 'TURN') {
        this.state = phase === 'idle' ? 'IDLE' : 'WALK';
      } else if (this.state !== 'IDLE' && this.state !== 'RUN') {
        this.state = phase === 'idle' ? 'IDLE' : 'WALK'; // 含 RUN 回归基态
      }

      // 入睡通道：持续行走 baseSleepAfter 秒后转 SLEEP
      if (this.state === 'WALK') {
        this.walkTime += dt;
        if (this.walkTime >= this.opt.baseSleepAfter && !input.userInteracting) {
          this.enterSleep();
        }
      } else {
        this.walkTime = 0;
      }

      // BehaviorSelector 判定（§12：集中选择器，权重 + 冷却 + 连续上限）；Phase 7 托盘可禁用随机行为
      if ((this.state === 'WALK' || this.state === 'IDLE') && !input.userInteracting && input.behaviorEnabled !== false) {
        this.rollAt -= dt;
        if (this.rollAt <= 0) {
          this.rollAt = this.opt.rollInterval;
          const pick = this.pickBehavior();
          if (pick) {
            this.state = pick;
            this.sleptFor = 0; // 超时兜底计时复位
            // 连续同动作计数：相同则 +1，切换不同动作则复位为 1（maxRepeat 语义）
            if (this.lastAction === pick) {
              this.repeatCount += 1;
            } else {
              this.lastAction = pick;
              this.repeatCount = 1;
            }
          }
        }
      }
    }

    const changed = this.state !== prev;
    if (changed && !SPECIAL.has(this.state) && this.state !== 'SLEEP') {
      this.lastAction = null;
      this.repeatCount = 0;
    }
    return this.output(changed);
  }

  /** one-shot 动画播完回调（app 接 AnimationEngine.onFinished）：回基态并进入全局冷却 */
  finishAction(): StateOutput {
    if (SPECIAL.has(this.state)) {
      this.globalCd = this.opt.globalCooldown;
      this.resumeBase();
    }
    return this.output(true);
  }

  /**
   * 显式触发（dev 面板点播 / 托盘 / Phase 6 交互）。BYPASS 权重与冷却（用户操作高于随机），
   * 但受"同状态不重复进入"约束外的幂等保护：由 app 决定是否重播动画。
   * 'turn' 为 movement 专属（转角才有），手动触发非法状态请求被忽略（T401 无非法状态）。
   */
  trigger(state: PetState): StateOutput {
    if (state === 'TURN') {
      return this.output(false);
    }
    if (state === 'SLEEP') {
      this.enterSleep();
    } else if (state === 'IDLE' || state === 'WALK' || state === 'RUN') {
      this.state = state;
      this.sleptFor = 0;
    } else if (SPECIAL.has(state)) {
      this.state = state;
      this.sleptFor = 0;
      this.lastAction = state;
      this.repeatCount = 1;
      if (this.opt.actions) {
        const def = this.opt.actions.find((a) => a.state === state);
        if (def) {
          this.cooldowns.set(def.state, def.cooldown); // 手动播发同样记账冷却
        }
      }
    }
    return this.output(true);
  }

  private enterSleep(): void {
    this.state = 'SLEEP';
    this.sleptFor = 0;
    this.walkTime = 0;
  }

  private resumeBase(): void {
    const phase = this.movePhaseOf();
    this.state = phase === 'idle' ? 'IDLE' : 'WALK';
    this.sleptFor = 0;
    this.rollAt = this.opt.rollInterval;
  }

  /** 权重表 + 冷却过滤 + 连续上限过滤 → rng 累计权重抽样（§12/§13） */
  private pickBehavior(): BehaviorAction | null {
    const defs = this.opt.actions;
    if (!defs || defs.length === 0 || this.globalCd > 0) {
      return null;
    }
    if (this.opt.rng() >= this.opt.triggerChance) {
      return null; // 60% 保持正常行走（PRD §7）
    }
    const candidates = defs.filter(
      (a) =>
        (this.cooldowns.get(a.state) ?? 0) <= 0 &&
        !(a.state === this.lastAction && this.repeatCount >= this.opt.maxRepeat),
    );
    if (candidates.length === 0) {
      return null;
    }
    const total = candidates.reduce((sum, a) => sum + a.weight, 0);
    let r = this.opt.rng() * total;
    for (const a of candidates) {
      r -= a.weight;
      if (r < 0) {
        this.cooldowns.set(a.state, a.cooldown);
        return a.state;
      }
    }
    return candidates[candidates.length - 1].state;
  }

  private output(changed: boolean): StateOutput {
    const inBase = this.state === 'IDLE' || this.state === 'WALK' || this.state === 'RUN' || this.state === 'TURN';
    return {
      state: this.state,
      animation: ANIM_OF[this.state],
      // MOVE_TO_TARGET 需保持移动开启；DRAGGED 交主进程光标接管（inBase 已排除）；TURN 属基态
      moveEnabled: this.state === 'MOVE_TO_TARGET' ? true : inBase,
      changed,
    };
  }
}
