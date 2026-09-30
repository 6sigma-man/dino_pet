/**
 * 配置数据模型与纯校验（TECH_DESIGN §19 配置 / PRD §15 配置持久化）。
 * 纯逻辑、零 Electron 依赖：便于主进程加载校验，也便于单测直连（dist/shared/config-schema.js）。
 * 字段集合对齐 TASK_LIST T801：speed / direction / behavior / clickThrough / nightMode / autoStart / monitor。
 */
import { WALK_SPEED_FAST, WALK_SPEED_NORMAL, WALK_SPEED_SLOW } from './constants';
import type { Language } from './i18n';
import { DEFAULT_LANGUAGE, LANGUAGES } from './i18n';
import type { MoveMode } from './movement';

export type SpeedMode = 'slow' | 'normal' | 'fast';
/** 方向复用移动引擎的 MoveMode（clockwise/counterclockwise/random，PRD F002） */
export type DirectionMode = MoveMode;

export interface DinoConfig {
  direction: DirectionMode;
  speed: SpeedMode;
  /** 随机行为开关（对应托盘 Behavior） */
  behaviorEnabled: boolean;
  /** 点击穿透（PRD：默认开启，不影响正常使用） */
  clickThrough: boolean;
  /** 夜间模式：23:00~07:00 慢速（PRD §13） */
  nightMode: boolean;
  /** 开机自启（实际系统写入见 T901，此处仅持久化） */
  autoStart: boolean;
  /** 目标显示器 id（null = 主显示器；迁移见 T902） */
  monitorId: string | null;
  /** 界面语言（需求扩展：托盘 + 设置窗口双语；'en' 纯英文默认 / 'zh' 中文） */
  language: Language;
}

export const DEFAULT_CONFIG: DinoConfig = {
  direction: 'clockwise',
  speed: 'normal',
  behaviorEnabled: true,
  clickThrough: true,
  nightMode: false,
  autoStart: false,
  monitorId: null,
  language: DEFAULT_LANGUAGE,
};

const DIRECTIONS: readonly DirectionMode[] = ['clockwise', 'counterclockwise', 'random'];
const SPEEDS: readonly SpeedMode[] = ['slow', 'normal', 'fast'];

function boolOr(v: unknown, d: boolean): boolean {
  return typeof v === 'boolean' ? v : d;
}

function oneOf<T extends string>(v: unknown, list: readonly T[], d: T): T {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d;
}

/**
 * 合并 + 校验：非法/缺失字段回落默认，保证返回结构完整。
 * 用于加载磁盘 JSON（可能损坏/版本不符）与写入前归一，杜绝坏配置导致崩溃。
 */
export function clampConfig(raw: unknown): DinoConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    direction: oneOf(r.direction, DIRECTIONS, DEFAULT_CONFIG.direction),
    speed: oneOf(r.speed, SPEEDS, DEFAULT_CONFIG.speed),
    behaviorEnabled: boolOr(r.behaviorEnabled, DEFAULT_CONFIG.behaviorEnabled),
    clickThrough: boolOr(r.clickThrough, DEFAULT_CONFIG.clickThrough),
    nightMode: boolOr(r.nightMode, DEFAULT_CONFIG.nightMode),
    autoStart: boolOr(r.autoStart, DEFAULT_CONFIG.autoStart),
    monitorId: typeof r.monitorId === 'string' && r.monitorId.length > 0 ? r.monitorId : null,
    language: oneOf(r.language, LANGUAGES, DEFAULT_CONFIG.language),
  };
}

/** 速度档 → px/s（PRD F003） */
export function speedModeToPx(mode: SpeedMode): number {
  return mode === 'slow' ? WALK_SPEED_SLOW : mode === 'fast' ? WALK_SPEED_FAST : WALK_SPEED_NORMAL;
}

/** PRD §13 夜间时段：23:00~07:00（含 23 时与 0~6 时） */
export function isNightHour(hour: number): boolean {
  return hour >= 23 || hour < 7;
}
