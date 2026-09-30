/**
 * 屏幕/工作区管理（TECH_DESIGN §2 Screen Manager，§6 窗口位置模型）。
 * 负责：主显示器工作区获取（自动扣除任务栏）、初始定位、坐标裁剪。
 * V1 默认主显示器；多显示器选择在 Phase 9 (T902) 实现。
 */
import { screen } from 'electron';
import { clampToWorkArea, WorkArea } from '../shared/geometry';
import { PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT } from '../shared/constants';

/** 主显示器工作区（workArea 已扣除任务栏，解决 T102「任务栏导致错位」验收项；DIP 坐标，与 setPosition 一致） */
export function getPrimaryWorkArea(): WorkArea {
  const display = screen.getPrimaryDisplay();
  return { ...display.workArea };
}

/** 需求扩展（指路模式）：主显示器完整 bounds（含任务栏区，作为 overlay 全屏矩形） */
export function getPrimaryDisplayBounds(): { x: number; y: number; width: number; height: number } {
  return { ...screen.getPrimaryDisplay().bounds };
}

/** 需求扩展（指路模式）：当前系统光标屏幕坐标（overlay 捕到点击瞬间取用，等于落点） */
export function cursorScreenPoint(): { x: number; y: number } {
  return screen.getCursorScreenPoint();
}

/** 初始位置：下边缘（BOTTOM 边）左侧 15% 处，恐龙脚底贴工作区底边；尺寸由调用方传入（dev 窗更大） */
export function getInitialPosition(
  winWidth: number,
  winHeight: number,
): { x: number; y: number } {
  const area = getPrimaryWorkArea();
  const rawX = area.x + Math.round(area.width * 0.15);
  const rawY = area.y + area.height - winHeight;
  return clampToWorkArea(rawX, rawY, winWidth, winHeight, area);
}

/** 任意目标坐标裁剪进工作区（供后续移动引擎与窗口重定位复用） */
export function clampIntoWorkArea(x: number, y: number): { x: number; y: number } {
  return clampToWorkArea(x, y, PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT, getPrimaryWorkArea());
}

/** 显示器概要（供设置页下拉；bounds 用 workArea 以避开任务栏） */
export interface DisplayInfo {
  id: string;
  label: string;
  workArea: WorkArea;
  primary: boolean;
}

/** 枚举所有显示器（TECH_DESIGN §21） */
export function listDisplays(): DisplayInfo[] {
  const all = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  return all.map((d) => ({
    id: String(d.id),
    label: `${d.bounds.width}x${d.bounds.height} @ ${d.bounds.x},${d.bounds.y}${d.id === primaryId ? '（主）' : ''}`,
    workArea: { ...d.workArea },
    primary: d.id === primaryId,
  }));
}

/** 按 id 取显示器工作区；不存在返回 null（显示器已拔出，交调用方回落主屏） */
export function getDisplayWorkArea(id: string | null): WorkArea | null {
  if (!id) {
    return null;
  }
  const d = screen.getAllDisplays().find((x) => String(x.id) === id);
  return d ? { ...d.workArea } : null;
}

/** T902：数值 id 的显示器当前是否仍连接 */
export function displayExistsById(id: number | null): boolean {
  if (id == null) {
    return false;
  }
  return screen.getAllDisplays().some((d) => d.id === id);
}

/** 按数值 id 取工作区（不存在 null） */
export function workAreaOfDisplay(id: number): WorkArea | null {
  const d = screen.getAllDisplays().find((x) => x.id === id);
  return d ? { ...d.workArea } : null;
}

/** 主显示器 id */
export function primaryDisplayId(): number {
  return screen.getPrimaryDisplay().id;
}

/** 给定矩形所在（最近）显示器 id（用于确定窗口当前归属屏） */
export function displayIdAtBounds(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): number {
  return screen.getDisplayMatching(bounds).id;
}

/** 主屏缩放因子（T903 DPI；dev 日志用） */
export function primaryScaleFactor(): number {
  return screen.getPrimaryDisplay().scaleFactor;
}

/**
 * T902：监听显示器 增/删/度量(分辨率·DPI) 变化（TECH_DESIGN §21）；返回退订函数。
 * 事件可能连发，调用方需做幂等重定位（本项目 engine.setWorkArea 幂等）。
 */
export function watchDisplayChanges(cb: () => void): () => void {
  screen.on('display-added', cb);
  screen.on('display-removed', cb);
  screen.on('display-metrics-changed', cb);
  return () => {
    screen.removeListener('display-added', cb);
    screen.removeListener('display-removed', cb);
    screen.removeListener('display-metrics-changed', cb);
  };
}
