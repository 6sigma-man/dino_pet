// 开发期图片裁剪工具（不参与打包）——从全屏截图中裁出恐龙特写供 README。
// 用法: node scripts/crop-png.js <in.png> <x> <y> <w> <h> <out.png>
const { PNG } = require('pngjs');
const fs = require('fs');

const [inPath, x, y, w, h, outPath] = process.argv.slice(2);
if (!inPath || x === undefined || !outPath) {
  console.error('用法: node scripts/crop-png.js <in.png> <x> <y> <w> <h> <out.png>');
  process.exit(1);
}
const src = PNG.sync.read(fs.readFileSync(inPath));
const X = +x, Y = +y, W = +w, H = +h;
if (X < 0 || Y < 0 || X + W > src.width || Y + H > src.height) {
  throw new Error(`裁剪区 ${X},${Y} ${W}x${H} 越界（原图 ${src.width}x${src.height}）`);
}
const out = new PNG({ width: W, height: H });
for (let row = 0; row < H; row++) {
  const s = (src.width * (Y + row) + X) * 4;
  const d = W * row * 4;
  src.data.copy(out.data, d, s, s + W * 4);
}
fs.writeFileSync(outPath, PNG.sync.write(out));
console.log('CROPPED', outPath, `${W}x${H}`);
