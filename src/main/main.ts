/**
 * DinoPet 主进程入口。
 * 职责（TECH_DESIGN §2）：应用生命周期 + 组装 Window/Screen/Config/Tray Manager + IPC。
 * 窗口能力在 window-manager.ts，屏幕定位在 screen-manager.ts，配置在 config-manager.ts（SKILL §32-2：禁止逻辑全写 main.ts）。
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import {
  APP_NAME,
  IPC_CHANNEL_PING,
  IPC_CHANNEL_SET_INTERACTIVE,
  IPC_CHANNEL_GET_WINDOW_INFO,
  IPC_CHANNEL_SET_MOVEMENT,
  IPC_CHANNEL_BEHAVIOR,
  IPC_CHANNEL_GET_CONFIG,
  IPC_CHANNEL_SET_CONFIG,
  IPC_CHANNEL_CONFIG_CHANGED,
  IPC_CHANNEL_GET_DISPLAYS,
  PET_WINDOW_WIDTH,
  PET_WINDOW_HEIGHT,
  DEV_WINDOW_WIDTH,
  DEV_WINDOW_HEIGHT,
} from '../shared/constants';
import type { MoveMode } from '../shared/movement';
import type { DinoConfig } from '../shared/config-schema';
import { isNightHour, speedModeToPx } from '../shared/config-schema';
import {
  createPetWindow,
  createSettingsWindow,
  createSunMarkerWindow,
  applyClickThrough,
  ClickThroughMode,
} from './window-manager';
import {
  getInitialPosition,
  getPrimaryWorkArea,
  cursorScreenPoint,
  getDisplayWorkArea,
  listDisplays,
  watchDisplayChanges,
  displayExistsById,
  workAreaOfDisplay,
  displayIdAtBounds,
  primaryScaleFactor,
} from './screen-manager';
import { createMovementEngine, MovementEngine } from './movement-engine';
import { createTray, TrayController } from './tray-manager';
import { createConfigManager, ConfigManager } from './config-manager';
import { uIOhook, UiohookMouseEvent } from 'uiohook-napi';

const isDev = process.argv.includes('--dev');
// 需求扩展④：落点“小太阳”标记窗边长/存活时长（CSS pop 动画 1100ms，销毁留余量确保淡出完整）
const SUN_MARKER_SIZE = 96;
const SUN_MARKER_MS = 1300;

// Phase 11（PRD 稳定性：主进程异常必须清晰日志）：后台常驻宠物不因未处理异常静默退出，
// 捕获后记录可诊断日志（不崩溃，尽量保持宠物存活）。
process.on('uncaughtException', (err: unknown) => {
  console.error('[ERROR] uncaughtException:', err);
});
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[ERROR] unhandledRejection:', reason);
});

// Phase 11（程序重复启动）：单实例锁——第二实例直接退出，仅唤起已有实例（见 second-instance）。
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
// 需求扩展④（全局钩子指路）：落点“小太阳”标记窗 + 其自动关闭定时器
let sunMarkerWin: BrowserWindow | null = null;
let sunCloseTimer: NodeJS.Timeout | null = null;
let clickThroughMode: ClickThroughMode = 'passive';
let movement: MovementEngine | null = null;
let tray: TrayController | null = null; // Phase 7：托盘常驻（模块级引用防 GC）
let isQuitting = false;

// Phase 8：配置为运行期单一真相
let config: ConfigManager | null = null;
let clickThroughEnabled = true; // config.clickThrough 镜像，门控 setInteractive
let lastNight = false; // 夜间慢速是否生效（用于低频轮询状态翻转）
let lastMonitorId: string | null | undefined; // 仅在显示器真正变化时重定位
let nightTimer: NodeJS.Timeout | null = null;

// Phase 9（T902）：当前恐龙所在显示器 id + 显示器变化监听退订
let currentDisplayId: number | null = null;
let displayWatcher: (() => void) | null = null;

// Phase 10（T1002）：dev-only 低频内存采样定时器（生产不启用，避免无意义定时器）
let perfTimer: NodeJS.Timeout | null = null;

const MOVE_MODES: readonly MoveMode[] = ['clockwise', 'counterclockwise', 'random'];

function createWindow(): void {
  // T102：初始定位 = 主显示器工作区内（自动避开任务栏）
  // dev 模式窗更宽：右侧容纳资产调试面板（03 接入文档第八阶段），正式模式仍为宠物小窗
  const size = isDev
    ? { width: DEV_WINDOW_WIDTH, height: DEV_WINDOW_HEIGHT }
    : { width: PET_WINDOW_WIDTH, height: PET_WINDOW_HEIGHT };
  const pos = getInitialPosition(size.width, size.height);
  mainWindow = createPetWindow({ ...pos, ...size });

  // T103：默认 PASSIVE 点击穿透，恐龙存在时桌面/浏览器/IDE 均可正常点击
  applyClickThrough(mainWindow, clickThroughMode);

  mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));

  // dev：转发 renderer console 到主进程 stdout，便于终端验证（SKILL §30/§31）
  if (isDev) {
    mainWindow.webContents.on(
      'console-message',
      (_event, level, message, line, sourceId) => {
        const tag = ['verbose', 'info', 'warn', 'error'][level] ?? 'log';
        console.log(`[RENDERER:${tag}] ${message} (${sourceId}:${line})`);
      },
    );
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
    const [x, y] = mainWindow?.getPosition() ?? [pos.x, pos.y];
    console.log(`[INFO] pet window at (${x}, ${y}), workArea=${JSON.stringify(getPrimaryWorkArea())}`);
  });

  // Phase 8：renderer 加载完成后补推行为开关（早于订阅的初始推送会丢失）
  mainWindow.webContents.on('did-finish-load', () => {
    if (config) {
      mainWindow?.webContents.send(IPC_CHANNEL_BEHAVIOR, config.get().behaviorEnabled);
    }
  });

  // Phase 11（PRD 窗口异常可恢复）：渲染进程崩溃/无响应 → 记录并自动重载（重载后 did-finish-load 重新推状态）
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error(`[ERROR] renderer gone (reason=${details.reason}, code=${details.exitCode}) → reload`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  });
  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[WARN] renderer unresponsive → reload');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  });
  // 加载失败仅日志诊断（不自动重载，避免本地资源缺失时重载循环）
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[ERROR] page load failed code=${code} desc=${desc} url=${url}`);
  });

  mainWindow.on('closed', () => {
    movement?.stop();
    movement = null;
    mainWindow = null;
  });

  // Phase 3：四边移动引擎（主进程驱动窗口位置，状态变化才推 renderer）
  movement = createMovementEngine(mainWindow, {
    workArea: getPrimaryWorkArea(),
    winWidth: size.width,
    winHeight: size.height,
    start: { x: pos.x, y: pos.y },
  });
  currentDisplayId = displayIdAtBounds(mainWindow.getBounds()); // Phase 9：记录初始所在屏
}

/** Phase 8：把配置应用到各子系统（移动引擎 / renderer / 点击穿透 / 自启 / 显示器） */
function applyConfig(cfg: DinoConfig): void {
  const night = cfg.nightMode && isNightHour(new Date().getHours());
  lastNight = night;
  if (movement) {
    movement.setMode(cfg.direction);
    movement.setSpeed(speedModeToPx(night ? 'slow' : cfg.speed)); // PRD §13 夜间慢速
  }
  // 显示器切换：仅在 monitorId 变化且目标存在时重定位（避免每次改速度都跳位）
  if (cfg.monitorId !== lastMonitorId) {
    const wa = getDisplayWorkArea(cfg.monitorId);
    if (wa) {
      movement?.setWorkArea(wa);
      if (mainWindow) {
        currentDisplayId = displayIdAtBounds(mainWindow.getBounds());
      }
    }
    lastMonitorId = cfg.monitorId;
  }
  // 随机行为开关 → 宠物 renderer 状态机
  mainWindow?.webContents.send(IPC_CHANNEL_BEHAVIOR, cfg.behaviorEnabled);
  // 点击穿透：关闭时强制窗口可交互
  clickThroughEnabled = cfg.clickThrough;
  if (mainWindow) {
    applyClickThrough(mainWindow, cfg.clickThrough ? clickThroughMode : 'interactive');
  }
  // 开机自启（T901 落地：写系统登录项；打包后真正生效，dev 下无副作用）
  try {
    app.setLoginItemSettings({ openAtLogin: cfg.autoStart });
  } catch (err) {
    console.warn(`[WARN] setLoginItemSettings failed: ${(err as Error).message}`);
  }
}

/** Phase 8：配置变化统一处理（set 成功后回调） */
function onConfigChanged(cfg: DinoConfig): void {
  applyConfig(cfg);
  tray?.refresh();
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send(IPC_CHANNEL_CONFIG_CHANGED, cfg);
  }
}

/** Phase 8：夜间时段翻转的低频检查（60s 一次，仅状态变化才重应用；非高频、无每帧日志） */
function checkNight(): void {
  if (!config) {
    return;
  }
  const cfg = config.get();
  const night = cfg.nightMode && isNightHour(new Date().getHours());
  if (night !== lastNight) {
    applyConfig(cfg);
  }
}

/** Phase 9（T902）：显示器增/删/度量(分辨率·DPI)变化 → 幂等重定位；当前屏消失则回落配置屏/主屏 */
function handleDisplaysChanged(): void {
  if (!mainWindow || !movement || !config) {
    return;
  }
  const cfgMonitor = config.get().monitorId;
  let target = cfgMonitor ? getDisplayWorkArea(cfgMonitor) : null; // 配置屏仍在线优先
  if (!target && currentDisplayId != null && displayExistsById(currentDisplayId)) {
    target = workAreaOfDisplay(currentDisplayId); // 否则留在当前屏（度量变化时取其新工作区）
  }
  if (!target) {
    target = getPrimaryWorkArea(); // 当前屏已拔出 → 自动迁移主屏
  }
  movement.setWorkArea(target); // 幂等：重算周长 + 把恐龙投影进目标屏并移动窗口
  currentDisplayId = displayIdAtBounds(mainWindow.getBounds());
  console.log(`[INFO] display change → workArea=${JSON.stringify(target)}, displayId=${currentDisplayId}`);
}

/** Phase 8：打开/聚焦设置窗口（T802） */
function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = createSettingsWindow();
  settingsWindow.once('ready-to-show', () => settingsWindow?.show());
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * 需求扩展④（全局钩子指路）：左键点桌面任意处 → 取光标当前屏坐标（DIP）为落点 → 恐龙**直线**走过去，
 * 并在落点显示一个会淡出的“小太阳”；到达后由 movement-engine 发 dino:arrived → renderer 吐水×3。
 * - 纯左键：点哪走哪（含上下，离开屏幕边直穿桌面）；被动钩子不拦截原点击。每次点击都 moveToTarget 覆盖旧目标 → “只追击最新一次，之前的放弃”。
 * - 坐标不取 uiohook 事件里的物理像素（DPI 缩放会偏），改用 screen.getCursorScreenPoint()（DIP，与 workArea 同坐标系，合 SKILL §25）。
 */
function onGlobalMouseDown(e: UiohookMouseEvent): void {
  // 纯左键(button=1)即触发（用户要求点哪走哪）；引擎未就绪则忽略
  if ((e.button as number) !== 1 || !movement) {
    return;
  }
  const pt = cursorScreenPoint(); // DIP 权威坐标
  // 仅当此刻窗口 interactive（渲染器判定光标在恐龙本体上）且点击落在窗口内 → 视为“点恐龙”，交给其点击互动、跳过指路。
  // 旧版只按整窗矩形判定，会把恐龙四周透明余量内的桌面点击误吞（表现为“点不动/不灵”）。
  if (clickThroughMode === 'interactive' && mainWindow && !mainWindow.isDestroyed()) {
    const b = mainWindow.getBounds();
    if (pt.x >= b.x && pt.x < b.x + b.width && pt.y >= b.y && pt.y < b.y + b.height) {
      return; // 点在恐龙本体上，交给恐龙自身互动，不作为指路目标
    }
  }
  const resolved = movement.moveToTarget(pt.x, pt.y); // 直线走向点击点（覆盖旧目标），返回真实落点
  showSunMarker(resolved.x, resolved.y);
}

/** 启动全局鼠标钩子（被动监听，不阻断系统点击）。失败仅日志，不影响宠物其余功能。 */
function startWalkToHook(): void {
  uIOhook.on('mousedown', onGlobalMouseDown);
  try {
    uIOhook.start();
  } catch (err) {
    console.error('[ERROR] global input hook failed to start (Alt+Click 指路不可用):', err);
  }
}

/** 停止钩子并清理小太阳（退出时调用）。 */
function stopWalkToHook(): void {
  try {
    uIOhook.removeListener('mousedown', onGlobalMouseDown);
    uIOhook.stop();
  } catch (err) {
    console.error('[ERROR] global input hook failed to stop:', err);
  }
  if (sunCloseTimer) {
    clearTimeout(sunCloseTimer);
    sunCloseTimer = null;
  }
  if (sunMarkerWin && !sunMarkerWin.isDestroyed()) {
    sunMarkerWin.close();
  }
  sunMarkerWin = null;
}

/** 落点小太阳：销毁上一个（若有）后在目标点居中创建标记窗，CSS 动画淡出后定时销毁。 */
function showSunMarker(x: number, y: number): void {
  if (sunCloseTimer) {
    clearTimeout(sunCloseTimer);
    sunCloseTimer = null;
  }
  if (sunMarkerWin && !sunMarkerWin.isDestroyed()) {
    sunMarkerWin.close();
    sunMarkerWin = null;
  }
  const win = createSunMarkerWindow(x, y, SUN_MARKER_SIZE);
  sunMarkerWin = win;
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
    }
  });
  win.on('closed', () => {
    if (sunMarkerWin === win) {
      sunMarkerWin = null;
    }
  });
  sunCloseTimer = setTimeout(() => {
    sunCloseTimer = null;
    if (!win.isDestroyed()) {
      win.close();
    }
  }, SUN_MARKER_MS);
}

function registerIpc(): void {
  // 链路自检（Phase 0 起保留）
  ipcMain.handle(IPC_CHANNEL_PING, () => {
    return { pong: true, version: app.getVersion(), isDev };
  });

  // T103：renderer 命中检测后请求切换交互模式（仅接受布尔值，防误用）
  ipcMain.on(IPC_CHANNEL_SET_INTERACTIVE, (event, active: unknown) => {
    if (typeof active !== 'boolean') {
      console.warn('[WARN] invalid setInteractive payload ignored');
      return;
    }
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return;
    }
    // Phase 8：关闭点击穿透时强制 interactive（忽略 renderer 的 passive 请求）
    let mode: ClickThroughMode = active ? 'interactive' : 'passive';
    if (!clickThroughEnabled) {
      mode = 'interactive';
    }
    if (mode === clickThroughMode) {
      return; // 幂等：状态未变不重复调用系统 API
    }
    clickThroughMode = mode;
    applyClickThrough(win, mode);
  });

  // Phase 3/6：移动控制（开关/模式/拖动/目标）。只接受白名单 payload，非法值拒绝 + WARN
  ipcMain.on(IPC_CHANNEL_SET_MOVEMENT, (_event, payload: unknown) => {
    if (!movement || typeof payload !== 'object' || payload === null) {
      console.warn('[WARN] invalid setMovement payload ignored');
      return;
    }
    const p = payload as {
      enabled?: unknown;
      mode?: unknown;
      dragStart?: unknown;
      dragEnd?: unknown;
      moveTo?: unknown;
      runAway?: unknown;
    };
    if (typeof p.enabled === 'boolean') {
      movement.setEnabled(p.enabled);
    }
    if (typeof p.mode === 'string' && (MOVE_MODES as readonly string[]).includes(p.mode)) {
      movement.setMode(p.mode as MoveMode);
    }
    // Phase 6：拖动开始（携带抓取点相对窗口偏移）/ 结束
    const ds = p.dragStart as { x?: unknown; y?: unknown } | undefined;
    if (ds && typeof ds.x === 'number' && typeof ds.y === 'number') {
      movement.beginDrag(ds.x, ds.y);
    }
    if (p.dragEnd === true) {
      movement.endDrag();
    }
    // Phase 6：点击移动到指定屏幕点 / 双击跑开
    const mt = p.moveTo as { x?: unknown; y?: unknown } | undefined;
    if (mt && typeof mt.x === 'number' && typeof mt.y === 'number') {
      movement.moveToTarget(mt.x, mt.y);
    }
    if (p.runAway === true) {
      movement.runAway();
    }
  });

  // 调试支持（SKILL §30/§31）：窗口位置 + 工作区，dev overlay 显示用
  ipcMain.handle(IPC_CHANNEL_GET_WINDOW_INFO, () => {
    const bounds = mainWindow?.getBounds();
    return {
      bounds: bounds ?? null,
      workArea: getPrimaryWorkArea(),
      clickThroughMode,
      movement: movement?.getPayload() ?? null,
    };
  });

  // Phase 8：配置读写（settings 窗口）+ 显示器列表
  ipcMain.handle(IPC_CHANNEL_GET_CONFIG, () => config?.get() ?? null);
  ipcMain.handle(IPC_CHANNEL_SET_CONFIG, (_event, partial: unknown) => {
    if (!config || typeof partial !== 'object' || partial === null) {
      console.warn('[WARN] invalid setConfig payload ignored');
      return config?.get() ?? null;
    }
    return config.set(partial as Partial<DinoConfig>); // 校验/落盘/应用经订阅，返回归一后完整配置
  });
  ipcMain.handle(IPC_CHANNEL_GET_DISPLAYS, () =>
    listDisplays().map((d) => ({ id: d.id, label: d.label, primary: d.primary })),
  );
}

// Phase 11：第二实例启动 → 不新建宠物，仅把已有窗口唤到前台并重挂置顶（亦缓解 Explorer 重启后 z-order 丢失）
app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }
  console.log('[INFO] second launch ignored (single-instance enforced)');
});

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) {
    return; // 非主实例：不创建窗口/托盘，待 quit 生效
  }
  config = createConfigManager(); // 须在 app ready 后（userData 路径）
  registerIpc();
  createWindow();
  // Phase 7：创建常驻托盘（T701）；Direction/Speed/Behavior 经 config 落盘广播，Settings 开设置窗，Exit 退出
  tray = createTray({
    engine: () => movement,
    config: () => config?.get() as DinoConfig,
    update: (partial) => config?.set(partial),
    onSettings: openSettings,
    onExit(): void {
      isQuitting = true;
      if (nightTimer) {
        clearInterval(nightTimer);
        nightTimer = null;
      }
      displayWatcher?.(); // Phase 9：退订显示器变化监听
      displayWatcher = null;
      if (perfTimer) {
        clearInterval(perfTimer);
        perfTimer = null;
      }
      stopWalkToHook(); // 需求扩展④：停止全局钩子并收起小太阳
      tray?.destroy();
      tray = null;
      app.quit();
    },
  });
  config.subscribe(onConfigChanged);
  applyConfig(config.get()); // 启动应用持久化配置（方向/速度/显示器/行为/穿透/自启）
  nightTimer = setInterval(checkNight, 60_000); // PRD §13 夜间时段低频翻转检查
  displayWatcher = watchDisplayChanges(handleDisplaysChanged); // Phase 9 T902：显示器拔出/变化自动迁移
  startWalkToHook(); // 需求扩展④：全局鼠标钩子（左键点桌面 → 走过去 + 落点小太阳；每次点击覆盖旧目标）
  console.log(`[INFO] ${APP_NAME} started (dev=${isDev}, version=${app.getVersion()})`);
  if (isDev) {
    console.log(`[INFO] primary display: scaleFactor=${primaryScaleFactor()} (T903 DPI)`);
    // Phase 10：启动一次 GPU 状态（T1003）+ dev-only 低频内存采样（T1002 1h soak 可观测）
    console.log(`[PERF] gpu feature status: ${JSON.stringify(app.getGPUFeatureStatus())} (T1003)`);
    const samplePerf = (): void => {
      const m = process.memoryUsage();
      const procs = app
        .getAppMetrics()
        .map((p) => `${p.type}=${(p.memory.workingSetSize / 1024).toFixed(0)}MB`)
        .join(' ');
      console.log(`[PERF] main rss=${(m.rss / 1048576).toFixed(1)}MB heap=${(m.heapUsed / 1048576).toFixed(1)}MB | ${procs}`);
    };
    samplePerf(); // 首个基线
    perfTimer = setInterval(samplePerf, 30_000); // 30s 低频，仅 dev；进程退出即清理
  }

  app.on('activate', () => {
    // macOS 场景兜底；Windows 主平台一般不会触发
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Phase 7：托盘常驻——无窗口不退出（仅 Exit 菜单真正 quit）；macOS 惯例同样不退出
  if (isQuitting) {
    app.quit();
  }
});
