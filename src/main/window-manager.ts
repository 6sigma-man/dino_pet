/**
 * 宠物窗口管理（TECH_DESIGN §2 Window Manager）。
 * 负责：透明无边框窗口创建（T101）、点击穿透模式切换（T103）。
 * 不负责：位置策略（screen-manager）、行为逻辑（renderer）。
 */
import { BrowserWindow } from 'electron';
import * as path from 'path';
import { APP_NAME } from '../shared/constants';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * T101 验收项全部在此：
 * 无边框 frame:false / 透明 transparent:true / 置顶 alwaysOnTop / skipTaskbar / 不可调整 resizable:false
 * 尺寸由调用方传入（dev 模式含调试面板区域，见 main.ts）。
 */
export function createPetWindow(bounds: WindowBounds): BrowserWindow {
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    title: APP_NAME,
    show: false, // 初始化完成后再显示，避免白闪
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false, // 透明窗口去阴影，避免矩形灰影
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true, // Electron 安全规范（SKILL §8）
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 桌面宠物需覆盖在普通窗口之上；'screen-saver' 层级可盖住全屏应用之外的所有窗口
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setMenu(null);

  return win;
}

/**
 * T802：轻量设置窗口（普通有框小窗，非透明、可关闭），复用同一 preload。
 * 禁复杂 SPA（TASK_LIST T802）：一个静态 HTML 表单即够。
 */
export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 340,
    height: 470,
    // 初始标题用语言中性的 APP_NAME；页面加载后由 settings.ts 按语言设 document.title 覆盖（避免中文闪现）
    title: APP_NAME,
    show: false,
    frame: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#f4f4f6',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, '../../src/renderer/settings.html'));
  return win;
}

/**
 * 需求扩展④（全局钩子指路）：落点“小太阳”标记窗——透明无边框、置顶、点击穿透的小窗，
 * 纯 CSS 动画显示后淡出，由主进程定时销毁。无 preload（纯装饰、不参与 IPC），不抢焦点。
 */
export function createSunMarkerWindow(x: number, y: number, size: number): BrowserWindow {
  const win = new BrowserWindow({
    x: Math.round(x - size / 2),
    y: Math.round(y - size / 2),
    width: size,
    height: size,
    title: `${APP_NAME} 目标`,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true); // 纯装饰，点击穿透到桌面
  win.setMenu(null);
  win.loadFile(path.join(__dirname, '../../src/renderer/sun-marker.html'));
  return win;
}

export type ClickThroughMode = 'passive' | 'interactive';

/**
 * T103：点击穿透状态切换。
 * passive    -> 窗口忽略鼠标（forward:true 使 renderer 仍能收到 mousemove 做命中检测）
 * interactive -> 窗口正常接收鼠标（用于拖动/点击恐龙，Phase 6 依赖此模式）
 */
export function applyClickThrough(win: BrowserWindow, mode: ClickThroughMode): void {
  if (mode === 'passive') {
    win.setIgnoreMouseEvents(true, { forward: true });
  } else {
    win.setIgnoreMouseEvents(false);
  }
}
