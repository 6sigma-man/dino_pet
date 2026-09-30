/**
 * 界面文案国际化词条（需求扩展：托盘 + 设置窗口中英双语，语言可选，默认纯英文）。
 * 纯数据、零依赖：主进程托盘（shared/i18n）与设置页渲染进程各自引用一份。
 * ⚠️ renderer 为 ESM 且与主进程隔离（rootDir 不同），无法 import 本文件；
 *    src/renderer/i18n.ts 是本文件的“手工同步副本”（约定同 constants.ts），
 *    两份 STRINGS 由 tests/unit/i18n.test.js 断言完全一致，改文案务必两处同改。
 * 语言名 lang.en / lang.zh 恒显示各自母语名（English / 简体中文），不随界面语言翻译，
 * 以便用户在误选陌生语言时仍能识别并切回。
 */

export type Language = 'en' | 'zh';

export const LANGUAGES: readonly Language[] = ['en', 'zh'];

/** 默认界面语言：纯英文（用户确认决策） */
export const DEFAULT_LANGUAGE: Language = 'en';

/** 各语言完整词条表；两份字典（en/zh）键集合必须一致 */
export const STRINGS: Record<Language, Record<string, string>> = {
  en: {
    // 托盘菜单
    'tray.pause': 'Pause',
    'tray.resume': 'Resume',
    'tray.direction': 'Direction',
    'tray.speed': 'Speed',
    'tray.behavior': 'Behavior',
    'tray.language': 'Language',
    'tray.settings': 'Settings\u2026',
    'tray.exit': 'Exit',
    'behavior.random': 'Random behaviors',
    // 方向 / 速度（托盘与设置页共用）
    'dir.clockwise': 'Clockwise',
    'dir.counterclockwise': 'Counterclockwise',
    'dir.random': 'Random',
    'speed.slow': 'Slow',
    'speed.normal': 'Normal',
    'speed.fast': 'Fast',
    // 语言选项（母语名，两字典同值）
    'lang.en': 'English',
    'lang.zh': '\u7b80\u4f53\u4e2d\u6587',
    // 设置窗口
    'settings.windowTitle': 'DinoPet Settings',
    'settings.heading': '\U0001F996 DinoPet Settings',
    'settings.group.movement': 'Movement',
    'settings.group.behavior': 'Behavior',
    'settings.group.system': 'System',
    'settings.group.language': 'Language',
    'settings.direction': 'Direction',
    'settings.speed': 'Speed',
    'settings.behavior': 'Random behaviors (fire / sleep, etc.)',
    'settings.clickThrough': 'Click-through (does not block the desktop)',
    'settings.nightMode': 'Night mode (slow during 23:00\u201307:00)',
    'settings.autoStart': 'Start automatically on boot',
    'settings.monitor': 'Target display',
    'settings.monitorDefault': 'Primary display (default)',
    'settings.monitorPrimary': ' (primary)',
    'settings.monitorHint': 'Display unplug / disconnect auto-fallback is finalized in Phase 9 (T902).',
    'settings.language': 'Interface language',
    'status.saved': 'Saved',
  },
  zh: {
    // 托盘菜单
    'tray.pause': '暂停',
    'tray.resume': '继续',
    'tray.direction': '方向',
    'tray.speed': '速度',
    'tray.behavior': '行为',
    'tray.language': '语言',
    'tray.settings': '设置\u2026',
    'tray.exit': '退出',
    'behavior.random': '随机行为',
    // 方向 / 速度
    'dir.clockwise': '顺时针',
    'dir.counterclockwise': '逆时针',
    'dir.random': '随机',
    'speed.slow': '慢',
    'speed.normal': '正常',
    'speed.fast': '快',
    // 语言选项（与 en 字典同值：母语名不翻译）
    'lang.en': 'English',
    'lang.zh': '\u7b80\u4f53\u4e2d\u6587',
    // 设置窗口
    'settings.windowTitle': 'DinoPet 设置',
    'settings.heading': '\U0001F996 DinoPet 设置',
    'settings.group.movement': '移动',
    'settings.group.behavior': '行为',
    'settings.group.system': '系统',
    'settings.group.language': '语言',
    'settings.direction': '方向',
    'settings.speed': '速度',
    'settings.behavior': '随机行为（吐火/睡觉等）',
    'settings.clickThrough': '点击穿透（不影响桌面操作）',
    'settings.nightMode': '夜间模式（23:00\u201307:00 慢速）',
    'settings.autoStart': '开机自动启动',
    'settings.monitor': '目标显示器',
    'settings.monitorDefault': '主显示器（默认）',
    'settings.monitorPrimary': '（主）',
    'settings.monitorHint': '显示器迁移的拔出/断开自动回退在 Phase 9（T902）完善。',
    'settings.language': '界面语言',
    'status.saved': '已保存',
  },
};

/** 取词条：缺失回落默认语言，再回落键名本身（绝不因缺词条而崩溃/空白） */
export function t(lang: Language, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS[DEFAULT_LANGUAGE][key] ?? key;
}
