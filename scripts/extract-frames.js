// scripts/extract-frames.js
// 从动画总表（如 Idle_Walk_Run.png）中切出单帧透明 PNG。
// 底图结构（实测）：页面背景透明(alpha≈0)；每条动画行是一个整块浅色圆角容器(alpha≈252)，
// 角色帧直接画在容器上（无独立底板），另有小号帧号徽章等碎片。
// 流程：连通域找行容器 -> 行内抠除均匀底色(边界洪泛) -> 角色级连通体按 x 排序 = 帧序列
//      -> 每帧基线归一化到 256x256 透明画布。
// 用法：node scripts/extract-frames.js <sheet.png> <outDir> <anim1,anim2,...>
// 说明：开发期资产工具（pngjs 仅 devDependency），产物 assets/dino/<anim>/NN.png 才是运行时资源。
'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const [,, sheetPath, outRoot, rowNamesArg] = process.argv;
if (!sheetPath || !outRoot || !rowNamesArg) {
  console.error('usage: node scripts/extract-frames.js <sheet.png> <outDir> <anim1,anim2,...>');
  process.exit(1);
}
const rowNames = rowNamesArg.split(',');
const FRAME_CANVAS = 256;      // 素材规范 §8：统一画布 256x256
const BASELINE_Y = 248;        // 统一脚底基线（SKILL §20：不同帧脚底基线一致）
const CHAR_MAX_SIZE = 236;     // 角色最长边上限（留余量）
const BG_TOL2 = 40 * 40;       // 底色容差（平方距离）
const MIN_CHAR_PIXELS = 3000;  // 角色连通体最小像素数（过滤徽章/文字）

const src = PNG.sync.read(fs.readFileSync(sheetPath));
const { width: W, height: H, data } = src;
const idx = (x, y) => (y * W + x) * 4;
const isPageBgAt = (x, y) => data[idx(x, y) + 3] < 100;

/* ---------- 1) 全图连通域，找行容器（宽条带） ---------- */
const visited = new Uint8Array(W * H);
const stack = new Int32Array(W * H);
const components = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const seed = y * W + x;
    if (visited[seed] || isPageBgAt(x, y)) continue;
    let sp = 0; stack[sp++] = seed; visited[seed] = 1;
    let minX = x, maxX = x, minY = y, maxY = y, count = 0;
    while (sp > 0) {
      const cur = stack[--sp];
      const cx = cur % W, cy = (cur - cx) / W;
      count++;
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (visited[ni] || isPageBgAt(nx, ny)) continue;
          visited[ni] = 1; stack[sp++] = ni;
        }
      }
    }
    components.push({ minX, maxX, minY, maxY, count });
  }
}
const bands = components
  .filter((c) => c.maxX - c.minX > 1000 && c.maxY - c.minY > 120 && c.maxY - c.minY < 500)
  .sort((a, b) => a.minY - b.minY);
if (bands.length !== rowNames.length) {
  console.error(`band mismatch: detected ${bands.length}, names ${rowNames.length}`);
  process.exit(1);
}

/* ---------- 2) 行内抠底色 + 角色连通体 ---------- */
function dist2(o, c) {
  const dr = data[o] - c[0], dg = data[o + 1] - c[1], db = data[o + 2] - c[2];
  return dr * dr + dg * dg + db * db;
}

function extractBand(band, name) {
  const x0 = band.minX, y0 = band.minY;
  const cw = band.maxX - x0 + 1, ch = band.maxY - y0 + 1;
  const bg = [data[idx(x0 + (cw >> 1), y0 + 4)], data[idx(x0 + (cw >> 1), y0 + 4) + 1], data[idx(x0 + (cw >> 1), y0 + 4) + 2]];
  const opaque = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const o = idx(x0 + x, y0 + y);
      const isBg = data[o + 3] < 100 || dist2(o, bg) < BG_TOL2;
      opaque[y * cw + x] = isBg ? 0 : 1;
    }
  }
  // 边界洪泛：与容器边缘连通的空隙确定为背景；封闭浅色（眼白等）自动保留
  const seen = new Uint8Array(cw * ch);
  let sp = 0;
  const push = (i) => { if (!seen[i]) { seen[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < cw; x++) { push(x); push((ch - 1) * cw + x); }
  for (let y = 0; y < ch; y++) { push(y * cw); push(y * cw + cw - 1); }
  while (sp > 0) {
    const cur = stack[--sp];
    if (opaque[cur]) continue;
    const cx = cur % cw, cy = (cur - cx) / cw;
    if (cx > 0) push(cur - 1);
    if (cx < cw - 1) push(cur + 1);
    if (cy > 0) push(cur - cw);
    if (cy < ch - 1) push(cur + cw);
  }
  for (let i = 0; i < opaque.length; i++) if (!seen[i]) opaque[i] = 1;

  // 连通体收集（8-邻域）
  const comp = new Uint8Array(cw * ch);
  const blobs = [];
  for (let i = 0; i < opaque.length; i++) {
    if (!opaque[i] || comp[i]) continue;
    const queue = [i]; comp[i] = 1;
    let minX = i % cw, maxX = minX, minY = (i - minX) / cw, maxY = minY, n = 0;
    while (queue.length) {
      const cur = queue.pop();
      const cx = cur % cw, cy = (cur - cx) / cw;
      n++;
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          const ni = ny * cw + nx;
          if (opaque[ni] && !comp[ni]) { comp[ni] = 1; queue.push(ni); }
        }
      }
    }
    if (n >= MIN_CHAR_PIXELS) blobs.push({ minX, maxX, minY, maxY, n });
  }
  blobs.sort((a, b) => a.minX - b.minX);
  blobs.forEach((b, i) => {
    const file = path.join(outRoot, name, `${String(i + 1).padStart(2, '0')}.png`);
    emitFrame(b, x0, y0, cw, file);
  });
  return blobs.length;
}

/* ---------- 3) 单帧归一化输出 ---------- */
function emitFrame(blob, ox, oy, stride, outPath) {
  const pad = 2;
  const bx0 = Math.max(0, blob.minX - pad), by0 = Math.max(0, blob.minY - pad);
  const bx1 = blob.maxX + pad, by1 = blob.maxY + pad;
  const sw = bx1 - bx0 + 1, sh = by1 - by0 + 1;
  const scale = Math.min(CHAR_MAX_SIZE / sw, CHAR_MAX_SIZE / sh, 1);
  const dw = Math.max(1, Math.round(sw * scale)), dh = Math.max(1, Math.round(sh * scale));
  const out = new PNG({ width: FRAME_CANVAS, height: FRAME_CANVAS });
  const px0 = Math.round((FRAME_CANVAS - dw) / 2);
  const py0 = BASELINE_Y - dh;
  // 行底色与 extractBand 同一采样规则（上边中点）
  const bg = [data[idx(ox + (stride >> 1), oy + 4)], data[idx(ox + (stride >> 1), oy + 4) + 1], data[idx(ox + (stride >> 1), oy + 4) + 2]];
  const keepAt = (x, y) => {
    const o = idx(ox + x, oy + y);
    return data[o + 3] >= 100 && dist2(o, bg) >= BG_TOL2;
  };
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx0 = bx0 + Math.floor((x * sw) / dw);
      const sx1 = Math.max(sx0 + 1, bx0 + Math.ceil(((x + 1) * sw) / dw));
      const sy0 = by0 + Math.floor((y * sh) / dh);
      const sy1 = Math.max(sy0 + 1, by0 + Math.ceil(((y + 1) * sh) / dh));
      let r = 0, g = 0, b = 0, a = 0, tot = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const keep = keepAt(sx, sy);
          const o = idx(ox + sx, oy + sy);
          r += keep ? data[o] : 0;
          g += keep ? data[o + 1] : 0;
          b += keep ? data[o + 2] : 0;
          a += keep ? 255 : 0;
          tot++;
        }
      }
      if (a === 0) continue;
      const kept = a / 255;
      const o = ((py0 + y) * FRAME_CANVAS + (px0 + x)) * 4;
      out.data[o] = Math.min(255, Math.round(r / kept));
      out.data[o + 1] = Math.min(255, Math.round(g / kept));
      out.data[o + 2] = Math.min(255, Math.round(b / kept));
      out.data[o + 3] = Math.round(a / tot); // a 已是 0~255 量纲，直接取均值
    }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, PNG.sync.write(out));
}

/* ---------- 4) 主流程 ---------- */
const report = [];
bands.forEach((band, ri) => {
  const frames = extractBand(band, rowNames[ri]);
  report.push({ animation: rowNames[ri], frames });
});
console.log(JSON.stringify({ source: path.basename(sheetPath), imageSize: `${W}x${H}`, report }, null, 2));
