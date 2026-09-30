/**
 * 设置页逻辑（T802，轻量：无框架 / 无 SPA，TASK_LIST 明确禁止复杂 SPA）。
 * 控件变更 → dinoAPI.setConfig(partial) 由主进程校验/落盘/即时生效；
 * 订阅 onConfig 与托盘菜单保持双向同步（任一侧改，另一侧回显）。
 * 文案经 i18n（renderer/i18n.ts 手工同步副本）按 config.language 渲染（需求扩展：默认纯英文，可切中文）。
 */
export {};

import { DEFAULT_LANGUAGE, t } from './i18n.js';
import type { Language } from './i18n.js';

type Direction = 'clockwise' | 'counterclockwise' | 'random';
type Speed = 'slow' | 'normal' | 'fast';

interface DinoConfig {
  direction: Direction;
  speed: Speed;
  behaviorEnabled: boolean;
  clickThrough: boolean;
  nightMode: boolean;
  autoStart: boolean;
  monitorId: string | null;
  language: Language;
}

/** 显示器概要（与 main screen-manager / preload DisplayInfo 手工同步） */
interface DisplaySummary {
  id: string;
  label: string;
  primary: boolean;
}

// window.dinoAPI 的全局类型由 app.ts 统一声明（同一 renderer 程序内共享），此处不重复声明。

/** 当前界面语言（初始默认英文，随配置回显更新）；供瞬时文案（已保存）与显示器下拉本地化使用 */
let curLang: Language = DEFAULT_LANGUAGE;
/** 显示器列表缓存（语言切换时按当前语言重渲染下拉标签） */
let displays: DisplaySummary[] = [];

function $el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

/** 按语言刷新所有静态文案（data-i18n 元素 + 文档标题 + <html lang>） */
function applyI18n(lang: Language): void {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t(lang, 'settings.windowTitle');
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(lang, key);
    }
  });
}

/** 用当前语言重建显示器下拉（首项=主显示器默认空值 + 各屏，主屏加标记） */
function renderMonitorOptions(selected: string): void {
  const sel = $el<HTMLSelectElement>('monitor');
  while (sel.firstChild) {
    sel.removeChild(sel.firstChild);
  }
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = t(curLang, 'settings.monitorDefault');
  sel.appendChild(auto);
  for (const d of displays) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.label}${d.primary ? t(curLang, 'settings.monitorPrimary') : ''}`;
    sel.appendChild(opt);
  }
  sel.value = selected;
}

let statusTimer: number | null = null;
function flashSaved(): void {
  const el = $el<HTMLElement>('status');
  el.textContent = t(curLang, 'status.saved');
  if (statusTimer !== null) {
    window.clearTimeout(statusTimer);
  }
  statusTimer = window.setTimeout(() => {
    el.textContent = '';
  }, 1200);
}

/** 把配置回填到表单控件 + 按语言刷新文案（初始加载 / 外部变更后同步） */
function applyToForm(cfg: DinoConfig): void {
  curLang = cfg.language;
  applyI18n(curLang);
  $el<HTMLSelectElement>('language').value = cfg.language;
  $el<HTMLSelectElement>('direction').value = cfg.direction;
  $el<HTMLSelectElement>('speed').value = cfg.speed;
  $el<HTMLInputElement>('behavior').checked = cfg.behaviorEnabled;
  $el<HTMLInputElement>('clickThrough').checked = cfg.clickThrough;
  $el<HTMLInputElement>('nightMode').checked = cfg.nightMode;
  $el<HTMLInputElement>('autoStart').checked = cfg.autoStart;
  renderMonitorOptions(cfg.monitorId ?? '');
}

async function push(partial: Partial<DinoConfig>): Promise<void> {
  const next = await window.dinoAPI.setConfig(partial);
  if (next) {
    applyToForm(next);
  }
  flashSaved();
}

function wire(): void {
  $el('language').addEventListener('change', (e) =>
    push({ language: (e.target as HTMLSelectElement).value as Language }),
  );
  $el('direction').addEventListener('change', (e) =>
    push({ direction: (e.target as HTMLSelectElement).value as Direction }),
  );
  $el('speed').addEventListener('change', (e) =>
    push({ speed: (e.target as HTMLSelectElement).value as Speed }),
  );
  $el('behavior').addEventListener('change', (e) =>
    push({ behaviorEnabled: (e.target as HTMLInputElement).checked }),
  );
  $el('clickThrough').addEventListener('change', (e) =>
    push({ clickThrough: (e.target as HTMLInputElement).checked }),
  );
  $el('nightMode').addEventListener('change', (e) =>
    push({ nightMode: (e.target as HTMLInputElement).checked }),
  );
  $el('autoStart').addEventListener('change', (e) =>
    push({ autoStart: (e.target as HTMLInputElement).checked }),
  );
  $el('monitor').addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    push({ monitorId: v === '' ? null : v });
  });
}

async function init(): Promise<void> {
  displays = await window.dinoAPI.getDisplays();
  const cfg = await window.dinoAPI.getConfig();
  if (cfg) {
    applyToForm(cfg);
  } else {
    // 取不到配置（异常兜底）：仍按默认语言刷新文案与显示器下拉
    applyI18n(curLang);
    renderMonitorOptions('');
  }
  wire();
  // 与托盘侧变更保持同步（含语言切换）
  window.dinoAPI.onConfig((c) => applyToForm(c));
}

window.addEventListener('DOMContentLoaded', () => {
  void init();
});
