/* 需求扩展：一次性动作队列（拖完喷火×3 / 到达吐水×3）纯逻辑单测。
 * 覆盖：start 返回首个 + 后续 next 顺序 drain、新 start 清空旧队列、pending 计数、clear、空入队。
 * 依赖 npm test 先经 tsconfig.unittest 编到 dist-unittest/state/ActionQueue.js。 */
const { test } = require('node:test');
const assert = require('node:assert');
const { ActionQueue } = require('../../dist-unittest/state/ActionQueue.js');

test('ActionQueue：start 返回首个动作，其余按顺序 next drain', () => {
  const q = new ActionQueue();
  assert.strictEqual(q.start(['FIRE', 'FIRE', 'FIRE']), 'FIRE');
  assert.strictEqual(q.pending, 2, '首个已取出，剩 2');
  assert.strictEqual(q.next(), 'FIRE');
  assert.strictEqual(q.next(), 'FIRE');
  assert.strictEqual(q.next(), null, 'drain 完返回 null');
  assert.strictEqual(q.pending, 0);
});

test('ActionQueue：新 start 清空旧队列（新交互打断旧的）', () => {
  const q = new ActionQueue();
  q.start(['FIRE', 'FIRE', 'FIRE']);
  assert.strictEqual(q.pending, 2);
  // 播放中途来了新的到达事件 → 用吐水替换整个队列
  assert.strictEqual(q.start(['WATER', 'WATER', 'WATER']), 'WATER');
  assert.strictEqual(q.pending, 2);
  assert.strictEqual(q.next(), 'WATER');
  // 不应再出现残留的 FIRE
  assert.strictEqual(q.next(), 'WATER');
  assert.strictEqual(q.next(), null);
});

test('ActionQueue：start 空数组返回 null 且 pending=0', () => {
  const q = new ActionQueue();
  assert.strictEqual(q.start([]), null);
  assert.strictEqual(q.pending, 0);
  assert.strictEqual(q.next(), null);
});

test('ActionQueue：clear 放弃未完成队列', () => {
  const q = new ActionQueue();
  q.start(['WATER', 'WATER', 'WATER']);
  q.clear();
  assert.strictEqual(q.pending, 0);
  assert.strictEqual(q.next(), null);
});

test('ActionQueue：start 不改动传入的只读源数组（内部 slice 拷贝）', () => {
  const q = new ActionQueue();
  const src = Object.freeze(['JUMP', 'TAIL']);
  q.start(src);
  q.next();
  assert.strictEqual(src.length, 2, '源数组未被 shift 破坏');
});
