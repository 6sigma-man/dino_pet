/**
 * 全局共享常量（主进程 / 渲染进程通用）。
 * 所有跨模块引用的固定数值集中于此，禁止散落在业务代码中（TECH_DESIGN §29-7）。
 * 注意：renderer 为 ESM 且与主进程隔离，renderer 侧同名常量需手工同步并在注释处标注本文件。
 */

export const APP_NAME = 'DinoPet';

/**
 * 恐龙桌面渲染尺寸（px）。素材规范：渲染尺寸 64~128 可调，取中间值 96。
 * 来源：DinoPet_AI_Asset_Pack_V1/01_CHARACTER_ASSET_SPEC.md §8
 */
export const DINO_RENDER_SIZE = 96;

/** 特效余量：火焰/水/ZZz 等特效超出恐龙本体的绘制空间（窗口只覆盖恐龙+少量特效区） */
export const EFFECT_MARGIN = 16;

/** 宠物窗口尺寸 = 恐龙 + 两侧特效余量（TECH_DESIGN §4.1：窗口只覆盖恐龙及少量特效区域） */
export const PET_WINDOW_WIDTH = DINO_RENDER_SIZE + EFFECT_MARGIN * 2;
export const PET_WINDOW_HEIGHT = DINO_RENDER_SIZE + EFFECT_MARGIN * 2;

/**
 * dev 模式窗口尺寸：正式宠物窗 + 右侧资产调试面板（03 接入文档第八阶段要求按钮切换动画）。
 * 仅 --dev 生效，正式运行仍是 PET_WINDOW_* 小窗（不违反 TECH_DESIGN §4.1 小窗策略）。
 */
export const DEV_WINDOW_WIDTH = 372;
export const DEV_WINDOW_HEIGHT = PET_WINDOW_HEIGHT;

/** IPC 通道名（preload / main 必须使用同一常量，禁止魔法字符串） */
export const IPC_CHANNEL_PING = 'dino:ping';
export const IPC_CHANNEL_SET_INTERACTIVE = 'dino:set-interactive';
export const IPC_CHANNEL_GET_WINDOW_INFO = 'dino:get-window-info';
/** Phase 3：主进程移动引擎 → renderer 状态推送（仅变化时发）；renderer → main 控制（开关/模式） */
export const IPC_CHANNEL_MOVEMENT_STATE = 'dino:movement-state';
export const IPC_CHANNEL_SET_MOVEMENT = 'dino:set-movement';
/** Phase 7：托盘行为开关（main → renderer，控制状态机随机行为启/禁） */
export const IPC_CHANNEL_BEHAVIOR = 'dino:behavior';
/** Phase 8：配置读写与变更广播（settings 窗口）+ 显示器列表 */
export const IPC_CHANNEL_GET_CONFIG = 'dino:get-config';
export const IPC_CHANNEL_SET_CONFIG = 'dino:set-config';
export const IPC_CHANNEL_CONFIG_CHANGED = 'dino:config-changed';
export const IPC_CHANNEL_GET_DISPLAYS = 'dino:get-displays';
/** 需求扩展④：到达目标点一次性事件（main → 宠物 renderer，触发吐水队列）；指路入口已改为全局鼠标钩子（main 直处理，无 IPC 通道）*/
export const IPC_CHANNEL_ARRIVED = 'dino:arrived';

/**
 * Phase 3 四边移动参数。
 * WALK_BASE_SPEED：PRD F003 normal 档 60~90 px/s 取中值；自然变化系数 0.75~1.25 在 movement.ts 内。
 * TURN_DURATION_S：turn 动画 5f@10fps = 0.5s，转角期间窗口暂停（TECH_DESIGN §8 禁瞬移）。
 * MOVE_TICK_MS：主进程无 rAF，用 16ms ticker + 真实 dt 计算（防漂移，满足 SKILL §24 意图，见 project_process.md）。
 */
export const WALK_BASE_SPEED = 75;
export const TURN_DURATION_S = 0.5;
export const MOVE_TICK_MS = 16;

/**
 * Phase 7 多档速度（PRD F003：slow 35~55 / normal 60~90 / fast 100~130 px/s）。
 * 自然速度变化（F004 0.75x~1.25x）仍由 movement.ts speedFactor 在此基础上叠加。
 */
export const WALK_SPEED_SLOW = 45;
export const WALK_SPEED_NORMAL = 75;
export const WALK_SPEED_FAST = 110;

/**
 * Phase 6 点击移动：到达目标后 IDLE 停顿毫秒数（PRD F007：到达后停留 1~3 秒再恢复）。
 */
export const IDLE_AFTER_TARGET_MS = 2000;

/**
 * 需求扩展（拖完吐火×3 / 到达后吐水×3）：队列中相邻动作的短暂间隔（ms）。
 * 上一个小动画自然播完后略停再开下一个，避免 3 次完全粘成一团。
 */
export const ACTION_GAP_MS = 180;
