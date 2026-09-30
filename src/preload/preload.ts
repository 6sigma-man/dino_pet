/**
 * Preload 桥：renderer 唯一能访问主能力的入口（TECH_DESIGN §20，SKILL §8）。
 * 注意：sandbox 下 preload 不 require 本地业务模块，通道名与 main 端 shared/constants.ts 手工保持一致。
 */
import { contextBridge, ipcRenderer } from 'electron';

interface PingResult {
  pong: boolean;
  version: string;
  isDev: boolean;
}

interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowInfo {
  bounds: { x: number; y: number; width: number; height: number } | null;
  workArea: WorkArea;
  clickThroughMode: 'passive' | 'interactive';
  movement: MovementState | null;
}

/** Phase 3 移动状态（与 shared/movement.ts 类型手工同步，sandbox 限制） */
interface MovementState {
  phase: 'idle' | 'walk' | 'turn';
  edge: 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT';
  facing: 'left' | 'right';
  moving: boolean;
  /** Phase 6 活动模式（与 movement-engine 手工同步） */
  activity: 'patrol' | 'target' | 'drag';
}

/** Phase 8 配置（与 shared/config-schema.ts 手工同步，sandbox 限制） */
interface DinoConfig {
  direction: 'clockwise' | 'counterclockwise' | 'random';
  speed: 'slow' | 'normal' | 'fast';
  behaviorEnabled: boolean;
  clickThrough: boolean;
  nightMode: boolean;
  autoStart: boolean;
  monitorId: string | null;
  /** 界面语言（需求扩展双语；与 shared/i18n Language 手工同步） */
  language: 'en' | 'zh';
}

/** Phase 8 显示器概要（与 screen-manager DisplayInfo 手工同步） */
interface DisplayInfo {
  id: string;
  label: string;
  primary: boolean;
}

contextBridge.exposeInMainWorld('dinoAPI', {
  /** 链路自检：Phase 0 起保留 */
  ping: (): Promise<PingResult> => ipcRenderer.invoke('dino:ping'),

  /** T103：true=进入交互（窗口接收鼠标）；false=恢复穿透 */
  setInteractive: (active: boolean): void => {
    ipcRenderer.send('dino:set-interactive', active);
  },

  /** 调试支持：获取窗口位置 / 工作区 / 当前穿透模式 / 移动状态 */
  getWindowInfo: (): Promise<WindowInfo> => ipcRenderer.invoke('dino:get-window-info'),

  /** Phase 3：订阅主进程移动状态推送（仅状态变化时触发）；返回退订函数 */
  onMovementState: (cb: (state: MovementState) => void): (() => void) => {
    const listener = (_event: unknown, state: MovementState) => cb(state);
    ipcRenderer.on('dino:movement-state', listener);
    return () => ipcRenderer.removeListener('dino:movement-state', listener);
  },

  /** Phase 3/6：移动控制（开关/模式/拖动/目标），payload 经 main 白名单校验 */
  setMovement(opts: {
    enabled?: boolean;
    mode?: string;
    dragStart?: { x: number; y: number };
    dragEnd?: boolean;
    moveTo?: { x: number; y: number };
    runAway?: boolean;
  }): void {
    ipcRenderer.send('dino:set-movement', opts);
  },

  /** Phase 7：订阅托盘行为开关（true=启用随机行为）；返回退订函数 */
  onBehavior(cb: (enabled: boolean) => void): () => void {
    const listener = (_event: unknown, enabled: boolean) => cb(enabled);
    ipcRenderer.on('dino:behavior', listener);
    return () => ipcRenderer.removeListener('dino:behavior', listener);
  },

  /** Phase 8：读取当前配置 */
  getConfig: (): Promise<DinoConfig | null> => ipcRenderer.invoke('dino:get-config'),

  /** Phase 8：写入部分配置（main 校验/落盘/应用），返回归一后完整配置 */
  setConfig: (partial: Partial<DinoConfig>): Promise<DinoConfig | null> =>
    ipcRenderer.invoke('dino:set-config', partial),

  /** Phase 8：订阅配置变更（供设置页与托盘保持同步）；返回退订函数 */
  onConfig(cb: (cfg: DinoConfig) => void): () => void {
    const listener = (_event: unknown, cfg: DinoConfig) => cb(cfg);
    ipcRenderer.on('dino:config-changed', listener);
    return () => ipcRenderer.removeListener('dino:config-changed', listener);
  },

  /** Phase 8：获取显示器列表（设置页 monitor 下拉） */
  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('dino:get-displays'),

  /** 需求扩展（宠物 renderer 订阅）：到达目标一次性事件 → 开吐水队列 */
  onArrived(cb: () => void): () => void {
    const listener = () => cb();
    ipcRenderer.on('dino:arrived', listener);
    return () => ipcRenderer.removeListener('dino:arrived', listener);
  },
});
