/**
 * 一次性动作队列（纯逻辑，零 DOM/Electron 依赖，可单测）。
 * 语义（需求扩展：拖完喷火×3 / 到达吐水×3）：
 * - start(states)：以新一组动作替换整个队列（"新交互打断旧的" = 清空旧队列），返回应立即播放的首个动作。
 * - next()：取下一个待播动作；无则 null。
 * - pending：剩余待播数量。
 * app.ts 负责在 next() 之间加入短暂间隔并驱动动画重播；本类只管排队与消费顺序。
 */
import type { PetState } from './StateMachine.js';

export class ActionQueue {
  private items: PetState[] = [];

  /** 清空旧队列并以 states 重新入队；返回应立即播放的首个（空数组则 null）。 */
  start(states: readonly PetState[]): PetState | null {
    this.items = states.slice();
    return this.next();
  }

  /** 取出下一个待播动作；队空返回 null。 */
  next(): PetState | null {
    return this.items.length > 0 ? (this.items.shift() as PetState) : null;
  }

  /** 剩余待播数量（不含正在播放的那个）。 */
  get pending(): number {
    return this.items.length;
  }

  /** 清空（如拖动抢占时放弃未完成队列）。 */
  clear(): void {
    this.items = [];
  }
}
