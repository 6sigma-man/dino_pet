/**
 * AnimationEngine 单测（T201 核心逻辑）。
 * 被测模块为纯逻辑（无 DOM），经 tsconfig.unittest.json 编译为 CJS 后 require。
 * 计时注意：dt 用 n/fps + 1e-4 缓冲，避免浮点累加恰好差 ε 不推进帧。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { AnimationEngine } = require('../../dist-unittest/animation/AnimationEngine.js');
const { ANIMATIONS } = require('../../dist-unittest/animation/AnimationManifest.js');

/** 精确推进 n 个动画帧（一次 update，引擎内部钳制在帧边界） */
function tickFrames(engine, n, fps) {
  engine.update(n / fps + 1e-4);
}

test('idle 循环动画：帧号推进并在 [0, frames) 内取模循环', () => {
  const e = new AnimationEngine();
  const def = ANIMATIONS.idle;
  e.setAnimation('idle');
  assert.strictEqual(e.frame, 0);

  tickFrames(e, 1, def.fps);
  assert.strictEqual(e.frame, 1);

  // 从帧 1 再走整轮（frames 帧）→ 取模回到 1
  tickFrames(e, def.frames, def.fps);
  assert.strictEqual(e.frame, 1);
  assert.strictEqual(e.isFinished, false, '循环动画不应 finished');
});

test('非循环动画（turn）：钳制最后一帧 + onFinished 只回调一次', () => {
  const e = new AnimationEngine();
  const done = [];
  e.onFinished = (id) => done.push(id);
  const def = ANIMATIONS.turn;
  e.setAnimation('turn');
  tickFrames(e, def.frames + 3, def.fps); // 远超总时长
  assert.strictEqual(e.frame, def.frames - 1, '应停在最后一帧');
  assert.strictEqual(e.isFinished, true);
  assert.deepStrictEqual(done, ['turn'], '回调恰好一次');
  tickFrames(e, 4, def.fps); // 已结束再播不应推进/回调
  assert.strictEqual(e.frame, def.frames - 1);
  assert.deepStrictEqual(done, ['turn']);
});

test('setAnimation 幂等：同动画播放中不重置；播完后重播从 0 开始', () => {
  const e = new AnimationEngine();
  e.setAnimation('walk');
  tickFrames(e, 3, ANIMATIONS.walk.fps);
  assert.strictEqual(e.frame, 3);
  e.setAnimation('walk'); // 播放中同动画 → 幂等忽略
  assert.strictEqual(e.frame, 3, '播放中重复 set 不应重置');

  e.setAnimation('turn'); // 切不同动画 → 从 0 开始
  assert.strictEqual(e.frame, 0);
  assert.strictEqual(e.id, 'turn');

  const def = ANIMATIONS.turn;
  tickFrames(e, def.frames + 1, def.fps);
  assert.strictEqual(e.isFinished, true);
  e.setAnimation('turn'); // 已结束同动画 → 重播
  assert.strictEqual(e.frame, 0);
  assert.strictEqual(e.isFinished, false);
});

test('update(0) 与 dt<=0 不推进帧', () => {
  const e = new AnimationEngine();
  e.setAnimation('run');
  e.update(0);
  e.update(-1);
  assert.strictEqual(e.frame, 0);
});
