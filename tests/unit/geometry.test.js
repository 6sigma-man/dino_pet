// 几何模块单测：clampToWorkArea / pointInRect（T102 定位正确性的算法基础）
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { clampToWorkArea, pointInRect } = require('../../dist/shared/geometry.js');

// 模拟 1920x1080 屏幕，底部任务栏 48px => workArea 1920x1032
const AREA = { x: 0, y: 0, width: 1920, height: 1032 };

test('工作区内的坐标保持不变', () => {
  const p = clampToWorkArea(500, 300, 128, 128, AREA);
  assert.deepStrictEqual(p, { x: 500, y: 300 });
});

test('右侧越界裁剪：窗口完整贴住右边界不超屏', () => {
  const p = clampToWorkArea(99999, 300, 128, 128, AREA);
  assert.strictEqual(p.x, 1920 - 128);
  assert.ok(p.x + 128 <= AREA.x + AREA.width);
});

test('底部越界裁剪：不压住任务栏（workArea 底边为界）', () => {
  const p = clampToWorkArea(500, 99999, 128, 128, AREA);
  assert.strictEqual(p.y, 1032 - 128);
  assert.ok(p.y + 128 <= AREA.y + AREA.height);
});

test('负坐标裁剪回工作区左上角', () => {
  const p = clampToWorkArea(-100, -100, 128, 128, AREA);
  assert.deepStrictEqual(p, { x: 0, y: 0 });
});

test('多显示器副屏负坐标：以带偏移的 workArea 为界', () => {
  const leftMonitor = { x: -1920, y: 0, width: 1920, height: 1080 };
  const p = clampToWorkArea(-99999, 500, 128, 128, leftMonitor);
  assert.strictEqual(p.x, -1920);
  assert.strictEqual(p.y, 500);
});

test('窗口大于工作区时不产生反向越界（NaN/最大<最小）', () => {
  const tiny = { x: 0, y: 0, width: 50, height: 50 };
  const p = clampToWorkArea(10, 10, 128, 128, tiny);
  assert.deepStrictEqual(p, { x: 0, y: 0 });
});

test('pointInRect 含边界判定', () => {
  assert.strictEqual(pointInRect(10, 10, 0, 0, 20, 20), true);
  assert.strictEqual(pointInRect(0, 0, 0, 0, 20, 20), true); // 边界
  assert.strictEqual(pointInRect(20, 20, 0, 0, 20, 20), true); // 边界
  assert.strictEqual(pointInRect(21, 10, 0, 0, 20, 20), false);
});
