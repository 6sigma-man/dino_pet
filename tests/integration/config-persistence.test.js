/* Config 持久化集成测试（Phase 12 Integration：Config 落盘/读回/归一/订阅）。
 * 走真实 fs（os.tmpdir 临时目录注入 filePath，不触达 electron app）。
 * 依赖 npm test 先行 `npm run build` 产出 dist/main/config-manager.js。 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createConfigManager } = require('../../dist/main/config-manager.js');

function tmpFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dinopet-cfg-'));
  return path.join(dir, name);
}

test('Config 集成：set 落盘 → 新实例读回归一后配置', () => {
  const f = tmpFile('config.json');
  const cm = createConfigManager(f);
  cm.set({ speed: 'fast', behaviorEnabled: false, monitorId: '123' });
  assert.ok(fs.existsSync(f), 'set 后应生成配置文件');
  const raw = JSON.parse(fs.readFileSync(f, 'utf-8'));
  assert.strictEqual(raw.speed, 'fast');
  const cm2 = createConfigManager(f); // 从磁盘重载
  assert.deepStrictEqual(cm2.get(), cm.get(), '重启读回应与写入一致');
});

test('Config 集成：坏 JSON 文件回落默认不崩（PRD 启动失败可诊断）', () => {
  const f = tmpFile('config.json');
  fs.writeFileSync(f, '{ not valid json ]', 'utf-8');
  const cm = createConfigManager(f); // load 内部 catch → 默认
  assert.strictEqual(cm.get().speed, 'normal', '坏配置应回落 DEFAULT.speed');
});

test('Config 集成：非法值在 set 落盘前经 clamp 归一', () => {
  const f = tmpFile('config.json');
  const cm = createConfigManager(f);
  const res = cm.set({ direction: 'bogus', speed: 'hyper', monitorId: '' });
  assert.strictEqual(res.direction, 'clockwise');
  assert.strictEqual(res.speed, 'normal');
  assert.strictEqual(res.monitorId, null, '空串 monitorId 归一为 null');
  const raw = JSON.parse(fs.readFileSync(f, 'utf-8'));
  assert.strictEqual(raw.direction, 'clockwise', '落盘的也是归一后值');
});

test('Config 集成：subscribe 收归一配置，退订后不再收', () => {
  const f = tmpFile('config.json');
  const cm = createConfigManager(f);
  const seen = [];
  const off = cm.subscribe((c) => seen.push(c.speed));
  cm.set({ speed: 'slow' });
  cm.set({ speed: 'fast' });
  off();
  cm.set({ speed: 'slow' });
  assert.deepStrictEqual(seen, ['slow', 'fast'], '仅订阅期间两次 set 回调');
});

test('Config 集成：目标目录不存在时 set 递归创建并落盘', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dinopet-cfg-'));
  const f = path.join(dir, 'nested', 'config.json');
  const cm = createConfigManager(f);
  assert.ok(!fs.existsSync(f));
  cm.set({ nightMode: true });
  assert.ok(fs.existsSync(f), 'persist 应 mkdir recursive');
  assert.strictEqual(createConfigManager(f).get().nightMode, true);
});
