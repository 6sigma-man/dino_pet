/**
 * 行为状态机单测（Phase 4：T401 状态转换 / T402 转角 turn / T403 BehaviorSelector）。
 * 被测模块为纯逻辑 src/renderer/state/StateMachine.ts，经 tsconfig.unittest.json 编译到 dist-unittest/。
 * 相位与随机源全部注入，保证确定性（不依赖真实时间/DOM）。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { DinoStateMachine } = require('../../dist-unittest/state/StateMachine.js');

const SPECIAL = new Set(['FIRE', 'WATER', 'TAIL', 'JUMP', 'REACTION']);
const DT = 1 / 60;

/** 构造可控相位的状态机；phase 变量被闭包读取 */
function makeSM(phaseRef, behavior) {
  return new DinoStateMachine({
    movePhase: () => phaseRef.value,
    behavior: {
      rollInterval: 1,
      triggerChance: 1, // 默认关闭概率闸门，聚焦冷却/重复逻辑；单独用例再测概率
      globalCooldown: 0,
      maxRepeat: 99,
      sleepDuration: 1e9,
      baseSleepAfter: 1e9,
      rng: () => 0,
      ...behavior,
    },
  });
}

/** 推进 sec 秒；每进入一次特殊动作立即记名并模拟 one-shot 播完（finishAction） */
function collectActions(sm, sec) {
  const acts = [];
  const steps = Math.round(sec / DT);
  for (let i = 0; i < steps; i++) {
    const out = sm.tick(DT, {});
    if (SPECIAL.has(out.state)) {
      acts.push(out.state);
      sm.finishAction();
    }
  }
  return acts;
}

/* -------------------- T401 状态与转换 -------------------- */

test('T401 基态跟随移动相位：walk/idle/turn → 对应动画，且基态请求恢复移动', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, { actions: null }); // 关闭随机行为，纯回归基态
  let out = sm.tick(DT, {});
  assert.strictEqual(out.state, 'WALK');
  assert.strictEqual(out.animation, 'walk');
  assert.strictEqual(out.moveEnabled, true);

  phase.value = 'idle';
  out = sm.tick(DT, {});
  assert.strictEqual(out.state, 'IDLE');
  assert.strictEqual(out.animation, 'idle');

  phase.value = 'turn';
  out = sm.tick(DT, {});
  assert.strictEqual(out.state, 'TURN');
  assert.strictEqual(out.animation, 'turn');
  assert.strictEqual(out.moveEnabled, true, 'TURN 属基态（转角暂停由移动引擎处理，非动作锁）');
});

test('T401 触发特殊动作：进入对应状态+动画、暂停移动；finishAction 回基态并恢复移动', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, { actions: null });
  sm.tick(DT, {}); // 建立 WALK 基态

  for (const [state, anim] of [
    ['FIRE', 'fire'],
    ['WATER', 'water'],
    ['TAIL', 'tail'],
    ['JUMP', 'jump'],
    ['REACTION', 'reaction'],
  ]) {
    const out = sm.trigger(state);
    assert.strictEqual(out.state, state);
    assert.strictEqual(out.animation, anim);
    assert.strictEqual(out.moveEnabled, false, `${state} 播放期间应暂停移动`);
  }

  const back = sm.finishAction();
  assert.strictEqual(back.state, 'WALK');
  assert.strictEqual(back.moveEnabled, true, '动作完成后恢复移动（T403 验收）');
});

test('T401 无非法状态：手动触发 TURN（移动专属）被忽略，不改变当前状态', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, { actions: null });
  sm.tick(DT, {});
  const before = sm.getState();
  const out = sm.trigger('TURN');
  assert.strictEqual(out.state, before, 'TURN 不可手动注入（防止脱离移动相位的非法转角）');
});

test('T401 SLEEP：可被触发进入并循环，定时/交互/手动基态均可唤醒', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, { actions: null, sleepDuration: 1 });
  const s = sm.trigger('SLEEP');
  assert.strictEqual(s.state, 'SLEEP');
  assert.strictEqual(s.animation, 'sleep');
  assert.strictEqual(s.moveEnabled, false);
  // 睡满 sleepDuration 自动醒
  const woke = collectActions(sm, 1.2);
  assert.deepStrictEqual(woke, [], 'SLEEP 非特殊一次性动作，不应记为行为');
  assert.notStrictEqual(sm.getState(), 'SLEEP', '定时到自动唤醒');
});

/* -------------------- T402 转角动画 -------------------- */

test('T402 转角链：WALK→TURN(播 turn)→WALK，视觉上由 turn 动画过渡而非瞬移', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, { actions: null });
  assert.strictEqual(sm.tick(DT, {}).animation, 'walk');
  phase.value = 'turn';
  assert.strictEqual(sm.tick(DT, {}).animation, 'turn', '到角进入 turn');
  phase.value = 'walk';
  assert.strictEqual(sm.tick(DT, {}).animation, 'walk', '转完继续 walk');
});

/* -------------------- T403 BehaviorSelector -------------------- */

test('T403 概率闸门：rng≥triggerChance 时保持行走（不触发行为）', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, {
    triggerChance: 0.4,
    rng: () => 0.5, // 0.5 ≥ 0.4 → 60% 正常走
    actions: [{ state: 'TAIL', weight: 1, cooldown: 0 }],
  });
  const acts = collectActions(sm, 5);
  assert.deepStrictEqual(acts, [], '未过概率阈值不应触发任何动作');
});

test('T403 权重选择：rng 累计权重抽样命中首个候选', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, {
    rng: () => 0, // 触发 + 选中首个候选
    actions: [
      { state: 'TAIL', weight: 8, cooldown: 1e9 },
      { state: 'FIRE', weight: 7, cooldown: 1e9 },
    ],
  });
  const acts = collectActions(sm, 1.1);
  assert.deepStrictEqual(acts, ['TAIL'], 'rng=0 → 落在权重区间首格 TAIL');
});

test('T403 冷却（cooldown）：同动作冷却期内不重复触发，避免连续刷同一动作', () => {
  const phase = { value: 'walk' };
  // 仅 TAIL，冷却 5s，关闭重复上限；10s 内应因冷却只触发 2 次（t≈1 与 t≈6）
  const sm = makeSM(phase, {
    rollInterval: 1,
    globalCooldown: 0,
    maxRepeat: 99,
    rng: () => 0,
    actions: [{ state: 'TAIL', weight: 1, cooldown: 5 }],
  });
  const acts = collectActions(sm, 7);
  assert.strictEqual(acts.length, 2, `冷却应把 7 次窗口压到 2 次，实际 ${acts.length}`);
  assert.deepStrictEqual(acts, ['TAIL', 'TAIL']);
});

test('T403 maxRepeat：无冷却时同动作连续上限后停止，不同动作可继续', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, {
    rollInterval: 1,
    globalCooldown: 0,
    maxRepeat: 2,
    rng: () => 0,
    actions: [{ state: 'TAIL', weight: 1, cooldown: 0 }],
  });
  const acts = collectActions(sm, 10);
  assert.strictEqual(acts.length, 2, '连续同动作最多 2 次，之后被 maxRepeat 过滤');
});

test('T403 多动作交替：首候选冷却后自动改选其他候选', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, {
    rollInterval: 1,
    globalCooldown: 0,
    maxRepeat: 99,
    rng: () => 0,
    actions: [
      { state: 'TAIL', weight: 1, cooldown: 5 },
      { state: 'FIRE', weight: 1, cooldown: 0 }, // FIRE 无冷却
    ],
  });
  const acts = collectActions(sm, 2.1);
  // t≈1：TAIL（TAIL 进入冷却）；t≈2：TAIL 冷却中→改选 FIRE
  assert.deepStrictEqual(acts, ['TAIL', 'FIRE'], '冷却过滤实现自然换动作');
});

test('T403 交互期间禁止随机行为（PRD §7 拖动/交互优先）', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, {
    rollInterval: 1,
    rng: () => 0,
    actions: [{ state: 'TAIL', weight: 1, cooldown: 0 }],
  });
  const acts = [];
  for (let i = 0; i < 120; i++) {
    const out = sm.tick(DT, { userInteracting: true });
    if (SPECIAL.has(out.state)) acts.push(out.state);
  }
  assert.deepStrictEqual(acts, [], 'userInteracting 时状态机不掷骰');
});

/* -------------------- Phase 6：拖动 / 走向目标（§11 最高优先级） -------------------- */

test('T601 dragging → DRAGGED：idle 动画、暂停自主移动', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, { actions: null });
  const out = sm.tick(DT, { dragging: true });
  assert.strictEqual(out.state, 'DRAGGED');
  assert.strictEqual(out.animation, 'idle');
  assert.strictEqual(out.moveEnabled, false);
});

test('T601 松开拖动后回基态（phase walk → WALK 并恢复移动）', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, { actions: null });
  sm.tick(DT, { dragging: true }); // 进 DRAGGED
  const out = sm.tick(DT, {}); // 松开回基态
  assert.strictEqual(out.state, 'WALK');
  assert.strictEqual(out.moveEnabled, true);
});

test('T601 拖动可打断正在播放的特殊动作（DRAGGED > SPECIAL）', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, { actions: null });
  sm.trigger('FIRE');
  assert.strictEqual(sm.getState(), 'FIRE');
  const out = sm.tick(DT, { dragging: true });
  assert.strictEqual(out.state, 'DRAGGED'); // 不被 SPECIAL 锁定
});

test('T602 movingToTarget → MOVE_TO_TARGET：walk 动画且保持移动开启', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, { actions: null });
  const out = sm.tick(DT, { movingToTarget: true });
  assert.strictEqual(out.state, 'MOVE_TO_TARGET');
  assert.strictEqual(out.animation, 'walk');
  assert.strictEqual(out.moveEnabled, true);
});

test('T602 到达后 idle 相位 → MOVE_TO_TARGET 显示 idle 动画（停顿）', () => {
  const phase = { value: 'idle' }; // 引擎到达目标后置 idle
  const sm = makeSM(phase, { actions: null });
  const out = sm.tick(DT, { movingToTarget: true });
  assert.strictEqual(out.state, 'MOVE_TO_TARGET');
  assert.strictEqual(out.animation, 'idle');
});

test('T602 目标结束后回基态，不再处于 MOVE_TO_TARGET', () => {
  const phase = { value: 'walk' };
  const sm = makeSM(phase, { actions: null });
  sm.tick(DT, { movingToTarget: true });
  const out = sm.tick(DT, {}); // movingToTarget 消失
  assert.strictEqual(out.state, 'WALK');
});

/* -------------------- Phase 7：托盘行为开关 -------------------- */

test('T702 behaviorEnabled=false 禁用随机行为（仅基态行走）', () => {
  const phase = { value: 'walk' };
  const cfg = { rollInterval: 1, rng: () => 0, actions: [{ state: 'TAIL', weight: 1, cooldown: 0 }] };
  const sm = makeSM(phase, cfg);
  const acts = [];
  for (let i = 0; i < 120; i++) {
    const out = sm.tick(DT, { behaviorEnabled: false });
    if (SPECIAL.has(out.state)) acts.push(out.state);
  }
  assert.deepStrictEqual(acts, [], 'behaviorEnabled=false 时不掷骰');
  // 对照：默认（undefined !== false）仍会触发随机行为
  const sm2 = makeSM(phase, cfg);
  const acts2 = [];
  for (let i = 0; i < 120; i++) {
    const out = sm2.tick(DT, {});
    if (SPECIAL.has(out.state)) {
      acts2.push(out.state);
      sm2.finishAction();
    }
  }
  assert.ok(acts2.length > 0, '默认启用随机行为');
});
