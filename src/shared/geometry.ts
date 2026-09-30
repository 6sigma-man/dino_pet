/**
 * 纯几何计算模块：坐标/工作区裁剪。
 * 不依赖 Electron API，保证可被 node --test 直接单测（Phase 12 Movement/坐标测试同源复用）。
 * 坐标统一使用 DIP（Device Independent Pixels），与 Electron workArea / setPosition 一致（SKILL §25 DPI 规范）。
 */

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * 将窗口左上角坐标裁剪进工作区，确保宽高 sizeW×sizeH 的窗口不被屏幕裁剪。
 * 若窗口尺寸大于工作区，则对齐到工作区左上角（不产生 NaN / 反向越界）。
 */
export function clampToWorkArea(
  x: number,
  y: number,
  sizeW: number,
  sizeH: number,
  area: WorkArea,
): Point {
  const minX = area.x;
  const minY = area.y;
  const maxX = area.x + Math.max(0, area.width - sizeW);
  const maxY = area.y + Math.max(0, area.height - sizeH);
  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  };
}

/** 判断点 (px,py) 是否落在以 (x,y) 为左上角、宽 sizeW 高 sizeH 的矩形内（含边界） */
export function pointInRect(
  px: number,
  py: number,
  x: number,
  y: number,
  sizeW: number,
  sizeH: number,
): boolean {
  return px >= x && px <= x + sizeW && py >= y && py <= y + sizeH;
}
