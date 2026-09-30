/**
 * 资产批量校验（开发期工具）：按 asset-manifest.json 校验 assets/dino 全部帧。
 * 检查项：磁盘帧数=清单 frames；每帧 256×256 RGBA；不透明像素充足（非空帧）；四角透明（真透明底）。
 * 用法：node scripts/validate-assets.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'asset-manifest.json'), 'utf8'));
const { width: W, height: H } = manifest.canvas;

let failures = 0;
const fail = (msg) => {
  console.error(`[FAIL] ${msg}`);
  failures++;
};

for (const [id, spec] of Object.entries(manifest.animations)) {
  const dir = path.join(ROOT, 'assets/dino', id);
  if (!fs.existsSync(dir)) {
    fail(`${id}: missing dir ${dir}`);
    continue;
  }
  const pngs = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
  if (pngs.length !== spec.frames) {
    fail(`${id}: disk ${pngs.length} png != manifest ${spec.frames}`);
  }
  for (let i = 1; i <= spec.frames; i++) {
    const name = `${String(i).padStart(2, '0')}.png`;
    const file = path.join(dir, name);
    if (!pngs.includes(name)) {
      fail(`${id}: missing frame ${name}`);
      continue;
    }
    const png = PNG.sync.read(fs.readFileSync(file));
    if (png.width !== W || png.height !== H) {
      fail(`${id}/${name}: ${png.width}x${png.height} != ${W}x${H}`);
      continue;
    }
    let opaque = 0;
    for (let p = 3; p < png.data.length; p += 4) {
      if (png.data[p] > 128) opaque++;
    }
    if (opaque < 1500) fail(`${id}/${name}: only ${opaque} opaque px (near-empty frame)`);
    // 四角应透明（真透明底，非白底板）
    const cornerAlpha = (x, y) => png.data[(y * png.width + x) * 4 + 3];
    const corners = [
      cornerAlpha(0, 0),
      cornerAlpha(png.width - 1, 0),
      cornerAlpha(0, png.height - 1),
      cornerAlpha(png.width - 1, png.height - 1),
    ];
    if (corners.some((a) => a > 128)) fail(`${id}/${name}: corner not transparent (alpha=${corners.join(',')})`);
  }
  console.log(`[OK] ${id}: ${spec.frames} frames checked`);
}

console.log(failures === 0 ? '\nAll assets PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
