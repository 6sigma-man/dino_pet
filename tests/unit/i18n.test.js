/**
 * i18n 词条一致性与完整性校验（需求扩展：托盘 + 设置窗口双语）。
 * shared/i18n.ts → dist/shared/i18n.js（主进程用，CJS）；
 * renderer/i18n.ts → dist-unittest/i18n.js（设置页手工同步副本，经 tsconfig.unittest 编 CJS）。
 * 核心守护：两份字典必须完全一致（防止只改一处导致托盘与设置页语言漂移）。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const shared = require('../../dist/shared/i18n.js');
const renderer = require('../../dist-unittest/i18n.js');

const KEYS = [
  // 托盘
  'tray.pause', 'tray.resume', 'tray.direction', 'tray.speed', 'tray.behavior',
  'tray.language', 'tray.settings', 'tray.exit', 'behavior.random',
  'dir.clockwise', 'dir.counterclockwise', 'dir.random',
  'speed.slow', 'speed.normal', 'speed.fast',
  'lang.en', 'lang.zh',
  // 设置窗口
  'settings.windowTitle', 'settings.heading',
  'settings.group.movement', 'settings.group.behavior', 'settings.group.system', 'settings.group.language',
  'settings.direction', 'settings.speed', 'settings.behavior', 'settings.clickThrough',
  'settings.nightMode', 'settings.autoStart', 'settings.monitor', 'settings.monitorDefault',
  'settings.monitorPrimary', 'settings.monitorHint', 'settings.language', 'status.saved',
];

test('shared 与 renderer 两份 STRINGS 完全一致（手工同步约定守护）', () => {
  assert.deepStrictEqual(renderer.STRINGS, shared.STRINGS);
});

test('两份 DEFAULT_LANGUAGE / LANGUAGES 一致，默认纯英文', () => {
  assert.strictEqual(shared.DEFAULT_LANGUAGE, 'en');
  assert.strictEqual(renderer.DEFAULT_LANGUAGE, shared.DEFAULT_LANGUAGE);
  assert.deepStrictEqual([...renderer.LANGUAGES], [...shared.LANGUAGES]);
  assert.deepStrictEqual([...shared.LANGUAGES].slice().sort(), ['en', 'zh']);
});

test('en / zh 键集合完全一致，且覆盖全部期望键', () => {
  for (const src of [shared, renderer]) {
    const enKeys = Object.keys(src.STRINGS.en).sort();
    const zhKeys = Object.keys(src.STRINGS.zh).sort();
    assert.deepStrictEqual(zhKeys, enKeys, 'zh 键集须与 en 一致');
    for (const k of KEYS) {
      assert.ok(enKeys.includes(k), `en 缺键 ${k}`);
      assert.ok(zhKeys.includes(k), `zh 缺键 ${k}`);
    }
  }
});

test('所有词条为非空字符串', () => {
  for (const src of [shared, renderer]) {
    for (const lang of ['en', 'zh']) {
      for (const [k, v] of Object.entries(src.STRINGS[lang])) {
        assert.strictEqual(typeof v, 'string', `${lang}.${k} 应为字符串`);
        assert.ok(v.length > 0, `${lang}.${k} 不应为空`);
      }
    }
  }
});

test('语言名恒显母语（en/zh 字典同值，不随界面语言翻译）', () => {
  for (const src of [shared, renderer]) {
    assert.strictEqual(src.STRINGS.en['lang.en'], src.STRINGS.zh['lang.en']);
    assert.strictEqual(src.STRINGS.en['lang.zh'], src.STRINGS.zh['lang.zh']);
    assert.strictEqual(src.STRINGS.en['lang.en'], 'English');
    assert.strictEqual(src.STRINGS.en['lang.zh'], '简体中文');
  }
});

test('t()：命中返回译文；未知语言/缺键回落默认语言再回落键名（不崩溃）', () => {
  assert.strictEqual(shared.t('zh', 'tray.exit'), '退出');
  assert.strictEqual(shared.t('en', 'tray.exit'), 'Exit');
  // @ts-expect-error 故意传非法语言，验证回落默认语言
  assert.strictEqual(shared.t('fr', 'tray.exit'), 'Exit');
  assert.strictEqual(shared.t('en', 'no.such.key'), 'no.such.key');
});
