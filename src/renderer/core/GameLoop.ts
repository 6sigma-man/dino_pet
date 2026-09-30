/**
 * 渲染主循环（requestAnimationFrame 驱动，TECH_DESIGN §14）。
 * dt 钳制上限 0.1s：窗口拖动/后台恢复会造成超大 dt，钳制避免动画瞬进与移动穿透（SKILL §24）。
 */
export const MAX_DT_SECONDS = 0.1;

export interface GameLoopHandle {
  start(): void;
  stop(): void;
}

export function createGameLoop(onStep: (dt: number) => void): GameLoopHandle {
  let running = false;
  let rafId = 0;
  let lastSeconds = 0;

  function tick(nowMs: number): void {
    if (!running) {
      return;
    }
    const now = nowMs / 1000;
    const raw = lastSeconds === 0 ? 0 : now - lastSeconds;
    lastSeconds = now;
    onStep(Math.min(Math.max(raw, 0), MAX_DT_SECONDS));
    rafId = requestAnimationFrame(tick);
  }

  return {
    start(): void {
      if (running) {
        return;
      }
      running = true;
      lastSeconds = 0;
      rafId = requestAnimationFrame(tick);
    },
    stop(): void {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
}
