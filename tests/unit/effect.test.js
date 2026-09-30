/**
 * 特效层单测（Phase 5：T501-T506 特效生命周期与清单）。
 * 被测：纯逻辑 effect/EffectEngine.ts + effect/EffectManifest.ts（tsconfig.unittest → dist-unittest/）。
 * 重点验收：一次性特效播完自动销毁（"火焰不残留" T501）、loop 幂等、清单与磁盘帧数一致。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { EffectEngine } = require('../../dist-unittest/effect/EffectEngine.js');
const { EFFECTS, validateEffects } = require('../../dist-unittest/effect/EffectManifest.js');

const DT = 1 / 60;

/* -------------------- 清单校验 -------------------- */

test('EffectManifest：validateEffects 无问题', () => {
  assert.deepStrictEqual(validateEffects(), []);
});

test('EffectManifest：sprite 特效磁盘帧数与清单一致（effects/ 每目录）', () => {
  for (const def of Object.values(EFFECTS)) {
    if (def.kind !== 'sprite') {
      continue;
    }
    const dir = path.join(__dirname, '../../effects', def.dir);
    assert.ok(fs.existsSync(dir), `缺少特效目录 ${dir}`);
    const pngs = fs.readdirSync(dir).filter((f) => /^\d+\.png$/.test(f));
    assert.strictEqual(pngs.length, def.frames, `${def.name}: 磁盘 ${pngs.length} 帧 ≠ 清单 ${def.frames}`);
  }
});

test('EffectManifest：fire/water 为嘴部弹体（anchor=mouth 且 travel>0），主体喷射仍由角色帧承担', () => {
  assert.strictEqual(EFFECTS.fire.anchor, 'mouth');
  assert.ok(EFFECTS.fire.travel > 0);
  assert.strictEqual(EFFECTS.water.anchor, 'mouth');
  assert.strictEqual(EFFECTS.zzz.kind, 'text', 'zzz 无正式素材 → 程序文字占位，不伪造 IP 美术');
});

/* -------------------- 生命周期（§16） -------------------- */

test('一次性特效：spawn 后在场，播满时长自动销毁（T501 火焰不残留）', () => {
  const eng = new EffectEngine(EFFECTS);
  eng.spawn('fire');
  assert.strictEqual(eng.activeCount, 1);
  assert.ok(eng.has('fire'));
  const life = EFFECTS.fire.frames / EFFECTS.fire.fps; // 6/12 = 0.5s
  for (let t = 0; t < life + 0.05; t += DT) {
    eng.update(DT);
  }
  assert.strictEqual(eng.activeCount, 0, '播完应被 prune');
  assert.strictEqual(eng.renderables().length, 0);
});

test('帧推进：frame 随 fps 递增且不越界', () => {
  const eng = new EffectEngine(EFFECTS);
  eng.spawn('fire');
  eng.update(1 / EFFECTS.fire.fps); // 前进 1 帧
  let r = eng.renderables()[0];
  assert.strictEqual(r.frame, 1);
  // 推进到超过总帧数前一瞬
  const eng2 = new EffectEngine(EFFECTS);
  eng2.spawn('fire');
  for (let t = 0; t < (EFFECTS.fire.frames - 0.5) / EFFECTS.fire.fps; t += DT) eng2.update(DT);
  r = eng2.renderables()[0];
  assert.ok(r.frame <= EFFECTS.fire.frames - 1, `frame ${r.frame} 越界`);
});

test('进度与淡出：progress 随生命周期 0→1，尾段 alpha 下降至 0', () => {
  const eng = new EffectEngine(EFFECTS);
  eng.spawn('fire');
  const first = eng.renderables()[0];
  assert.ok(first.progress < 0.1, '起始 progress≈0');
  assert.strictEqual(first.alpha, 1);
  const life = EFFECTS.fire.frames / EFFECTS.fire.fps;
  for (let t = 0; t < life * 0.9; t += DT) eng.update(DT);
  const late = eng.renderables()[0];
  assert.ok(late.progress > 0.75, `尾段 progress=${late.progress.toFixed(2)}`);
  assert.ok(late.alpha < 1, `尾段应淡出 alpha=${late.alpha.toFixed(2)}`);
});

test('loop 特效（zzz）：spawn 幂等不叠加，持续到 cancel', () => {
  const eng = new EffectEngine(EFFECTS);
  eng.spawn('zzz');
  eng.spawn('zzz');
  eng.spawn('zzz');
  assert.strictEqual(eng.activeCount, 1, 'loop 型同名幂等');
  for (let t = 0; t < 3; t += DT) eng.update(DT); // 长时间不自动销毁
  assert.ok(eng.has('zzz'));
  eng.cancel('zzz');
  assert.strictEqual(eng.activeCount, 0, 'cancel 后收回');
});

test('多特效并存：一次性 fire 与 loop zzz 互不影响销毁', () => {
  const eng = new EffectEngine(EFFECTS);
  eng.spawn('zzz');
  eng.spawn('fire');
  assert.strictEqual(eng.activeCount, 2);
  const life = EFFECTS.fire.frames / EFFECTS.fire.fps;
  for (let t = 0; t < life + 0.05; t += DT) eng.update(DT);
  assert.strictEqual(eng.activeCount, 1, 'fire 销毁、zzz 保留');
  assert.ok(eng.has('zzz'));
});

test('update(dt<=0) 不推进（防暂停/零帧抖动）', () => {
  const eng = new EffectEngine(EFFECTS);
  eng.spawn('fire');
  eng.update(0);
  eng.update(-1);
  assert.strictEqual(eng.renderables()[0].frame, 0);
});
