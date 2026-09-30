/**
 * 四边移动路径算法单测（T301-T304 验收核心，纯函数 shared/movement.ts）。
 * 被测模块经 tsconfig.json 编译为 CJS 到 dist/shared/。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  pathRect,
  nextEdge,
  edgeEnd,
  facingOn,
  nearestEdgePoint,
  createMoveState,
  stepMove,
} = require('../../dist/shared/movement.js');

const AREA = { x: 0, y: 0, width: 1707, height: 1019 }; // 实测主屏工作区（已扣任务栏）
const WIN = 128;
const RECT = pathRect(AREA, WIN, WIN);
const OPTS = (over = {}) => ({
  rect: RECT,
  baseSpeed: 75,
  turnDuration: 0.5,
  mode: 'clockwise',
  rng: () => 0.5, // 固定：speedFactor=1.0，random 转向=ccw
  ...over,
});
const DT = 1 / 60;

/** 推进 sec 秒，返回 [state, 全部历史状态] */
function run(state, sec, opts, collect = false) {
  const hist = [];
  for (let t = 0; t < sec; t += DT) {
    state = stepMove(state, DT, opts).next;
    if (collect) hist.push(state);
  }
  return collect ? [state, hist] : state;
}

function inRect(s) {
  return s.x >= RECT.minX - 0.01 && s.x <= RECT.maxX + 0.01
    && s.y >= RECT.minY - 0.01 && s.y <= RECT.maxY + 0.01;
}

test('pathRect：窗口左上角合法范围 = 工作区扣自身尺寸（T301 不越界的定义）', () => {
  assert.deepStrictEqual(RECT, { minX: 0, minY: 0, maxX: 1707 - 128, maxY: 1019 - 128 });
  // 窗口大于工作区时钳到 min（退化，不产生负宽高）
  const big = pathRect(AREA, 5000, 5000);
  assert.strictEqual(big.maxX, big.minX);
});

test('nextEdge：顺时针 TOP→RIGHT→BOTTOM→LEFT（T302）；逆时针反向（T303）', () => {
  assert.strictEqual(nextEdge('TOP', 'cw'), 'RIGHT');
  assert.strictEqual(nextEdge('RIGHT', 'cw'), 'BOTTOM');
  assert.strictEqual(nextEdge('BOTTOM', 'cw'), 'LEFT');
  assert.strictEqual(nextEdge('LEFT', 'cw'), 'TOP');
  assert.strictEqual(nextEdge('TOP', 'ccw'), 'LEFT');
  assert.strictEqual(nextEdge('LEFT', 'ccw'), 'BOTTOM');
  assert.strictEqual(nextEdge('BOTTOM', 'ccw'), 'RIGHT');
  assert.strictEqual(nextEdge('RIGHT', 'ccw'), 'TOP');
});

test('edgeEnd：四条边按方向的终点角与 §7.1 线段一致', () => {
  assert.deepStrictEqual(edgeEnd('TOP', 'cw', RECT), { x: RECT.maxX, y: RECT.minY });
  assert.deepStrictEqual(edgeEnd('RIGHT', 'cw', RECT), { x: RECT.maxX, y: RECT.maxY });
  assert.deepStrictEqual(edgeEnd('BOTTOM', 'cw', RECT), { x: RECT.minX, y: RECT.maxY });
  assert.deepStrictEqual(edgeEnd('LEFT', 'cw', RECT), { x: RECT.minX, y: RECT.minY });
});

test('facingOn：横边=行进方向、竖边贴墙；素材朝右主方向下翻转语义正确', () => {
  assert.strictEqual(facingOn('TOP', 'cw'), 'right');
  assert.strictEqual(facingOn('BOTTOM', 'cw'), 'left');
  assert.strictEqual(facingOn('RIGHT', 'cw'), 'right');
  assert.strictEqual(facingOn('LEFT', 'cw'), 'left');
  assert.strictEqual(facingOn('TOP', 'ccw'), 'left');
  assert.strictEqual(facingOn('BOTTOM', 'ccw'), 'right');
});

test('T302 顺时针闭环：从 BOTTOM 出发依次经过 LEFT→TOP→RIGHT 回到 BOTTOM', () => {
  let s = createMoveState(500, RECT.maxY, 'BOTTOM', 'cw');
  const visited = [];
  for (let i = 0; i < 60 * 60 * 10; i++) {
    const prevEdge = s.edge;
    s = stepMove(s, DT, OPTS()).next;
    if (s.edge !== prevEdge) {
      visited.push(s.edge);
      if (visited.length === 4) break;
    }
  }
  assert.deepStrictEqual(visited, ['LEFT', 'TOP', 'RIGHT', 'BOTTOM']);
});

test('T303 逆时针闭环：从 BOTTOM 出发依次经过 RIGHT→TOP→LEFT', () => {
  let s = createMoveState(500, RECT.maxY, 'BOTTOM', 'ccw');
  const visited = [];
  for (let i = 0; i < 60 * 60 * 10; i++) {
    const prevEdge = s.edge;
    s = stepMove(s, DT, OPTS({ mode: 'counterclockwise' })).next;
    if (s.edge !== prevEdge) {
      visited.push(s.edge);
      if (visited.length === 3) break;
    }
  }
  assert.deepStrictEqual(visited, ['RIGHT', 'TOP', 'LEFT']);
});

test('转角处理（§8 禁瞬移）：换边时精确落位角点，turn 停顿后才继续走', () => {
  // 距左下角 10px 出发，一步跨过角点
  let s = createMoveState(RECT.minX + 10, RECT.maxY, 'BOTTOM', 'cw');
  const r1 = stepMove(s, 1, OPTS()); // 75px*dt=75 > 10 → 到角
  s = r1.next;
  assert.strictEqual(s.x, RECT.minX, '角点精确落位（不越过、不瞬移到下一边中段）');
  assert.strictEqual(s.y, RECT.maxY);
  assert.strictEqual(s.phase, 'turn');
  assert.strictEqual(s.edge, 'LEFT', '角点处已切入下一边');
  // turn 期间位置不动
  const before = { x: s.x, y: s.y };
  s = run(s, 0.3, OPTS());
  assert.deepStrictEqual({ x: s.x, y: s.y }, before, 'turn 停顿期间不移动');
  assert.strictEqual(s.phase, 'turn');
  // 0.5s 后恢复 walk 且沿 LEFT 边上行
  s = run(s, 0.3, OPTS());
  assert.strictEqual(s.phase, 'walk');
  s = run(s, 1, OPTS());
  assert.ok(s.y < RECT.maxY, '恢复后沿 LEFT 边向上');
  assert.strictEqual(s.x, RECT.minX);
});

test('连续 5 分钟模拟（T302/T303 验收）：不越界、无跳变、无 NaN', () => {
  for (const mode of ['clockwise', 'counterclockwise', 'random']) {
    let s = createMoveState(500, RECT.maxY, 'BOTTOM', 'cw');
    const opts = OPTS({ mode });
    let prev = s;
    for (let i = 0; i < 60 * 300; i++) {
      s = stepMove(s, DT, opts).next;
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y), `${mode}: NaN at step ${i}`);
      assert.ok(inRect(s), `${mode}: out of rect at step ${i}: ${s.x},${s.y}`);
      const jump = Math.abs(s.x - prev.x) + Math.abs(s.y - prev.y);
      assert.ok(jump <= 75 * 1.25 * DT + 1e-6, `${mode}: teleport ${jump} at step ${i}`);
      prev = s;
    }
  }
});

test('T304 随机模式：rng<0.5 时角点换向，且不卡角（持续产生位移）', () => {
  // BOTTOM 边顺时针终点=左下角，距角 20px 出发一步跨角
  let s = createMoveState(RECT.minX + 20, RECT.maxY, 'BOTTOM', 'cw');
  const opts = OPTS({ mode: 'random', rng: () => 0.9 }); // 每次角点都翻成 ccw（rng≥0.5）
  s = stepMove(s, 1, opts).next;
  assert.strictEqual(s.phase, 'turn');
  assert.strictEqual(s.dir, 'ccw', 'rng=0.9≥0.5 → 换向 ccw');
  s = run(s, 0.6, opts); // turn 结束
  s = run(s, 2, opts);   // 若卡角会原地打转；实际应转入 BOTTOM/ccw 向右离开角点
  assert.ok(s.x > RECT.minX + 50, `未卡死在角落，应向右离开（实际 x=${s.x}）`);
});

test('退化路径（窗口≥工作区）：钉住不动转 idle，不死循环', () => {
  const deg = pathRect({ x: 0, y: 0, width: 100, height: 100 }, 128, 128);
  let s = createMoveState(50, 50, 'BOTTOM', 'cw');
  const r = stepMove(s, DT, OPTS({ rect: deg }));
  assert.strictEqual(r.next.phase, 'idle');
  assert.deepStrictEqual({ x: r.next.x, y: r.next.y }, { x: 0, y: 0 });
});

test('自然速度变化（F004）：每段 walk 的 speedFactor 在 0.75~1.25', () => {
  let s = createMoveState(RECT.minX + 5, RECT.maxY, 'BOTTOM', 'cw');
  s = stepMove(s, 1, OPTS({ rng: () => 0.999 })).next; // 到角
  s = run(s, 0.6, OPTS({ rng: () => 0.999 })); // turn 结束取新 factor≈1.25
  assert.ok(s.speedFactor >= 0.75 && s.speedFactor <= 1.25, `factor=${s.speedFactor}`);
  assert.ok(Math.abs(s.speedFactor - 1.25) < 0.01);
});

/* -------------------- Phase 6：最近边投影（拖动落位/点击移动目标） -------------------- */

test('nearestEdgePoint：靠近上边的内部点投影到 TOP，纵向贴边、横向保持', () => {
  const midX = (RECT.minX + RECT.maxX) / 2;
  const p = nearestEdgePoint(midX, RECT.minY + 20, RECT);
  assert.strictEqual(p.edge, 'TOP');
  assert.strictEqual(p.y, RECT.minY);
  assert.strictEqual(p.x, midX);
});

test('nearestEdgePoint：中心偏右下的点投影到 BOTTOM', () => {
  const x = RECT.minX + (RECT.maxX - RECT.minX) * 0.6;
  const y = RECT.maxY - 30; // 距底边 30 < 距右边
  const p = nearestEdgePoint(x, y, RECT);
  assert.strictEqual(p.edge, 'BOTTOM');
  assert.strictEqual(p.y, RECT.maxY);
  assert.strictEqual(p.x, x);
});

test('nearestEdgePoint：矩形外的点先夹进合法范围再投影（右侧远点 → RIGHT）', () => {
  const midY = (RECT.minY + RECT.maxY) / 2;
  const p = nearestEdgePoint(RECT.maxX + 500, midY, RECT);
  assert.strictEqual(p.edge, 'RIGHT');
  assert.strictEqual(p.x, RECT.maxX);
  assert.strictEqual(p.y, midY); // 纵向合法，保持
});

test('nearestEdgePoint：已在边上的点幂等（同边同点）', () => {
  const onLeft = nearestEdgePoint(RECT.minX, 400, RECT);
  assert.strictEqual(onLeft.edge, 'LEFT');
  assert.strictEqual(onLeft.x, RECT.minX);
  assert.strictEqual(onLeft.y, 400);
});
