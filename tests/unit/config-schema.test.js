/**
 * 配置纯逻辑单测（T801 验收核心，纯函数 shared/config-schema.ts）。
 * 被测模块经 tsconfig.json 编译为 CJS 到 dist/shared/。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  DEFAULT_CONFIG,
  clampConfig,
  speedModeToPx,
  isNightHour,
} = require('../../dist/shared/config-schema.js');
const { WALK_SPEED_SLOW, WALK_SPEED_NORMAL, WALK_SPEED_FAST } = require('../../dist/shared/constants.js');
const { DEFAULT_LANGUAGE } = require('../../dist/shared/i18n.js');

test('clampConfig：空/非对象回落默认', () => {
  assert.deepStrictEqual(clampConfig(undefined), DEFAULT_CONFIG);
  assert.deepStrictEqual(clampConfig(null), DEFAULT_CONFIG);
  assert.deepStrictEqual(clampConfig(123), DEFAULT_CONFIG);
  assert.deepStrictEqual(clampConfig('x'), DEFAULT_CONFIG);
  assert.deepStrictEqual(clampConfig({}), DEFAULT_CONFIG);
});

test('clampConfig：合法字段原样保留', () => {
  const raw = {
    direction: 'counterclockwise',
    speed: 'fast',
    behaviorEnabled: false,
    clickThrough: false,
    nightMode: true,
    autoStart: true,
    monitorId: '7',
    language: 'zh',
  };
  assert.deepStrictEqual(clampConfig(raw), raw);
});

test('clampConfig：非法枚举/类型回落对应默认', () => {
  const c = clampConfig({
    direction: 'sideways',
    speed: 'hyper',
    behaviorEnabled: 'yes',
    clickThrough: 1,
    nightMode: null,
    autoStart: 'true',
    language: 'fr',
  });
  assert.strictEqual(c.direction, DEFAULT_CONFIG.direction);
  assert.strictEqual(c.speed, DEFAULT_CONFIG.speed);
  assert.strictEqual(c.behaviorEnabled, DEFAULT_CONFIG.behaviorEnabled);
  assert.strictEqual(c.clickThrough, DEFAULT_CONFIG.clickThrough);
  assert.strictEqual(c.nightMode, DEFAULT_CONFIG.nightMode);
  assert.strictEqual(c.autoStart, DEFAULT_CONFIG.autoStart);
  assert.strictEqual(c.language, DEFAULT_CONFIG.language);
});

test('clampConfig：monitorId 空串归一为 null，字符串保留', () => {
  assert.strictEqual(clampConfig({ monitorId: '' }).monitorId, null);
  assert.strictEqual(clampConfig({ monitorId: '3' }).monitorId, '3');
  assert.strictEqual(clampConfig({ monitorId: 5 }).monitorId, null); // 非字符串拒绝
});

test('clampConfig：输出结构字段齐全（防漏字段）', () => {
  const keys = Object.keys(clampConfig({})).sort();
  assert.deepStrictEqual(keys, Object.keys(DEFAULT_CONFIG).sort());
});

test('clampConfig：language 默认纯英文，合法 zh 保留，非法回落默认', () => {
  assert.strictEqual(DEFAULT_CONFIG.language, DEFAULT_LANGUAGE);
  assert.strictEqual(DEFAULT_LANGUAGE, 'en');
  assert.strictEqual(clampConfig({}).language, 'en');
  assert.strictEqual(clampConfig({ language: 'zh' }).language, 'zh');
  assert.strictEqual(clampConfig({ language: 'en' }).language, 'en');
  assert.strictEqual(clampConfig({ language: 'de' }).language, 'en'); // 非法枚举回落
});

test('speedModeToPx：三档映射到常量且 slow<normal<fast', () => {
  assert.strictEqual(speedModeToPx('slow'), WALK_SPEED_SLOW);
  assert.strictEqual(speedModeToPx('normal'), WALK_SPEED_NORMAL);
  assert.strictEqual(speedModeToPx('fast'), WALK_SPEED_FAST);
  assert.ok(WALK_SPEED_SLOW < WALK_SPEED_NORMAL && WALK_SPEED_NORMAL < WALK_SPEED_FAST);
});

test('isNightHour：23:00~07:00 为夜间（PRD §13）', () => {
  for (const h of [23, 0, 3, 6]) {
    assert.strictEqual(isNightHour(h), true, `${h} 应为夜间`);
  }
  for (const h of [7, 12, 18, 22]) {
    assert.strictEqual(isNightHour(h), false, `${h} 应为白天`);
  }
});
