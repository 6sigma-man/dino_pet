// Phase 1 冒烟测试：验证共享常量导出与构建产物链路（node --test）
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  APP_NAME,
  DINO_RENDER_SIZE,
  EFFECT_MARGIN,
  PET_WINDOW_WIDTH,
  PET_WINDOW_HEIGHT,
  IPC_CHANNEL_PING,
  IPC_CHANNEL_SET_INTERACTIVE,
} = require('../../dist/shared/constants.js');

test('shared/constants 导出应用名', () => {
  assert.strictEqual(APP_NAME, 'DinoPet');
});

test('宠物窗口尺寸 = 恐龙渲染尺寸 + 两侧特效余量', () => {
  assert.strictEqual(PET_WINDOW_WIDTH, DINO_RENDER_SIZE + EFFECT_MARGIN * 2);
  assert.strictEqual(PET_WINDOW_HEIGHT, DINO_RENDER_SIZE + EFFECT_MARGIN * 2);
});

test('窗口尺寸在素材规范允许范围（渲染 64~128，窗口略大容纳特效）', () => {
  assert.ok(DINO_RENDER_SIZE >= 64 && DINO_RENDER_SIZE <= 128);
  assert.ok(PET_WINDOW_WIDTH > DINO_RENDER_SIZE);
});

test('IPC 通道常量为非空字符串', () => {
  assert.strictEqual(typeof IPC_CHANNEL_PING, 'string');
  assert.strictEqual(typeof IPC_CHANNEL_SET_INTERACTIVE, 'string');
});
