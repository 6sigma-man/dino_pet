/**
 * 动画清单与资产结构校验（T202 验收核心）。
 * 规则：
 * 1. 10 组动画全部为正式素材（Final Asset Pack，2026-09-29 补齐）；
 * 2. assets/dino/<dir>/ 的 PNG 帧数必须与 manifest frames 一致，且命名 NN.png 从 01 连续；
 * 3. TS 清单与根目录 asset-manifest.json（素材方权威清单）的 frames/fps/loop 完全一致。
 * 像素级质量校验见 scripts/validate-assets.js（256×256/透明底/非空帧）。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { ANIMATIONS, DINO_SOURCE_FACING } = require('../../dist-unittest/animation/AnimationManifest.js');
const { validateManifest } = require('../../dist-unittest/animation/AnimationDefinition.js');

const ASSET_ROOT = path.join(__dirname, '../../assets/dino');
const SOURCE_MANIFEST = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../asset-manifest.json'), 'utf8'),
);

test('清单结构校验通过（validateManifest 无问题）', () => {
  assert.deepStrictEqual(validateManifest(ANIMATIONS), []);
});

test('10 组动画齐全（T202）', () => {
  assert.strictEqual(Object.keys(ANIMATIONS).length, 10);
});

test('素材主方向声明为 right（Final Asset Pack 朝右，朝左靠水平翻转）', () => {
  assert.strictEqual(DINO_SOURCE_FACING, 'right');
});

test('全部动画组均为正式素材（placeholder 必须为 false）', () => {
  for (const [id, def] of Object.entries(ANIMATIONS)) {
    assert.strictEqual(def.placeholder, false, `${id} should be real asset now`);
  }
});

test('磁盘 PNG 帧数与清单一致且 01..NN 连续、无多余文件', () => {
  for (const [id, def] of Object.entries(ANIMATIONS)) {
    const dir = path.join(ASSET_ROOT, def.dir);
    assert.ok(fs.existsSync(dir), `missing dir ${dir}`);
    const pngs = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
    assert.strictEqual(pngs.length, def.frames, `${id}: disk ${pngs.length} png != manifest ${def.frames}`);
    for (let i = 1; i <= def.frames; i++) {
      const name = `${String(i).padStart(2, '0')}.png`;
      assert.ok(pngs.includes(name), `${id}: missing frame ${name}`);
    }
  }
});

test('TS 清单与素材方 asset-manifest.json 完全一致（frames/fps/loop）', () => {
  const srcAnims = SOURCE_MANIFEST.animations;
  assert.deepStrictEqual(Object.keys(srcAnims).sort(), Object.keys(ANIMATIONS).sort());
  for (const [id, src] of Object.entries(srcAnims)) {
    const def = ANIMATIONS[id];
    assert.strictEqual(def.frames, src.frames, `${id}: frames mismatch`);
    assert.strictEqual(def.fps, src.fps, `${id}: fps mismatch`);
    assert.strictEqual(def.loop, src.loop, `${id}: loop mismatch`);
  }
  assert.strictEqual(SOURCE_MANIFEST.directionStrategy.authored, DINO_SOURCE_FACING);
});

test('idle/walk/run 关键循环动画配置正确（T201 验收前提）', () => {
  for (const id of ['idle', 'walk', 'run']) {
    assert.ok(ANIMATIONS[id], `${id} missing`);
    assert.strictEqual(ANIMATIONS[id].loop, true, `${id} should loop`);
  }
});
