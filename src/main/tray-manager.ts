/**
 * 系统托盘管理（TECH_DESIGN §2 Tray Manager / §22，T701/T702）。
 * 托盘常驻：Pause/Resume 直控引擎（运行时态，不持久化）；
 * Direction/Speed/Behavior/Language 经 config.update 落盘并广播（Phase 8 起以 Config 为单一真相，与设置页同步）；
 * 菜单文案经 i18n 按 config.language 渲染（需求扩展：默认纯英文，可切中文）；
 * Settings 打开轻量设置窗口（T802）；Exit 退出应用。
 */
import { Menu, nativeImage, Tray } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import type { DinoConfig, SpeedMode } from '../shared/config-schema';
import type { Language } from '../shared/i18n';
import { t } from '../shared/i18n';
import type { MoveMode } from '../shared/movement';
import type { MovementEngine } from './movement-engine';

export interface TrayController {
  destroy(): void;
  /** 配置从外部（设置页）变化时刷新菜单勾选态 */
  refresh(): void;
}

export interface TrayOptions {
  /** 取当前移动引擎（窗口关闭后为 null，回调需容错） */
  engine: () => MovementEngine | null;
  /** 当前配置（用于菜单勾选回显） */
  config: () => DinoConfig;
  /** 更新配置（main 侧持久化 + 应用 + 广播） */
  update: (partial: Partial<DinoConfig>) => void;
  /** 打开设置窗口 */
  onSettings: () => void;
  /** 退出应用（main 负责置 isQuitting + 销毁托盘 + app.quit） */
  onExit: () => void;
}

/** 托盘图标：复用正式 idle 首帧（真实 IP 素材，非伪造），缩到 16px；缺文件则空图兜底不崩溃 */
function trayIcon(): Electron.NativeImage {
  const p = path.join(__dirname, '../../assets/dino/idle/01.png');
  const img = nativeImage.createFromPath(p).resize({ width: 16, height: 16 });
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

export function createTray(opts: TrayOptions): TrayController {
  const tray = new Tray(trayIcon());
  tray.setToolTip('DinoPet');

  let paused = false; // 运行时态，不持久化

  function dirItems(): MenuItemConstructorOptions[] {
    const cfg = opts.config();
    const mk = (mode: MoveMode, key: string): MenuItemConstructorOptions => ({
      label: t(cfg.language, key),
      type: 'radio',
      checked: cfg.direction === mode,
      click: () => {
        opts.update({ direction: mode });
        rebuild();
      },
    });
    return [
      mk('clockwise', 'dir.clockwise'),
      mk('counterclockwise', 'dir.counterclockwise'),
      mk('random', 'dir.random'),
    ];
  }

  function speedItems(): MenuItemConstructorOptions[] {
    const cfg = opts.config();
    const mk = (mode: SpeedMode, key: string): MenuItemConstructorOptions => ({
      label: t(cfg.language, key),
      type: 'radio',
      checked: cfg.speed === mode,
      click: () => {
        opts.update({ speed: mode });
        rebuild();
      },
    });
    return [mk('slow', 'speed.slow'), mk('normal', 'speed.normal'), mk('fast', 'speed.fast')];
  }

  /** 语言子菜单：选项恒显各语言母语名（English / 简体中文），不随界面语言翻译 */
  function langItems(): MenuItemConstructorOptions[] {
    const cfg = opts.config();
    const mk = (mode: Language): MenuItemConstructorOptions => ({
      label: t(cfg.language, `lang.${mode}`),
      type: 'radio',
      checked: cfg.language === mode,
      click: () => {
        opts.update({ language: mode });
        rebuild();
      },
    });
    return [mk('en'), mk('zh')];
  }

  function rebuild(): void {
    const cfg = opts.config();
    const lang = cfg.language;
    const template: MenuItemConstructorOptions[] = [
      {
        label: paused ? t(lang, 'tray.resume') : t(lang, 'tray.pause'),
        click: () => {
          paused = !paused;
          opts.engine()?.setPaused(paused);
          rebuild();
        },
      },
      { type: 'separator' },
      { label: t(lang, 'tray.direction'), submenu: dirItems() },
      { label: t(lang, 'tray.speed'), submenu: speedItems() },
      {
        label: t(lang, 'tray.behavior'),
        submenu: [
          {
            label: t(lang, 'behavior.random'),
            type: 'checkbox',
            checked: cfg.behaviorEnabled,
            click: (item) => {
              opts.update({ behaviorEnabled: item.checked });
              rebuild();
            },
          },
        ],
      },
      { label: t(lang, 'tray.language'), submenu: langItems() },
      { type: 'separator' },
      { label: t(lang, 'tray.settings'), click: () => opts.onSettings() },
      { label: t(lang, 'tray.exit'), click: () => opts.onExit() },
    ];
    tray.setContextMenu(Menu.buildFromTemplate(template));
  }

  rebuild();

  return {
    refresh(): void {
      rebuild();
    },
    destroy(): void {
      tray.destroy();
    },
  };
}
