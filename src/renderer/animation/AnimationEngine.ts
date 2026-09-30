/**
 * 动画播放引擎（TECH_DESIGN §14 Animation Controller 核心）。
 * 职责：帧序号推进 + FPS 计时 + loop/一次性播放 + 播完回调。
 * 纯逻辑模块：不依赖 DOM/Electron，可被 node --test 单测（tsconfig.unittest.json 编译）。
 * 不负责：图片加载与画布绘制（SpriteSheet/DinoRenderer）、状态机选择播哪个动画（Phase 4）。
 */
import type { AnimationId } from './AnimationDefinition.js';
import { ANIMATIONS } from './AnimationManifest.js';

export class AnimationEngine {
  private currentId: AnimationId = 'idle';
  private frameIndex = 0;
  /** 帧累加器（秒）：dt 驱动，避免帧率与渲染帧率耦合 */
  private accumulator = 0;
  private finished = false;
  private finishedHandler: ((id: AnimationId) => void) | null = null;

  /** 非循环动画播完一次性回调（Phase 5 技能结束后回 idle 依赖它） */
  set onFinished(handler: ((id: AnimationId) => void) | null) {
    this.finishedHandler = handler;
  }

  get id(): AnimationId {
    return this.currentId;
  }

  get frame(): number {
    return this.frameIndex;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  get def() {
    return ANIMATIONS[this.currentId];
  }

  /**
   * 切换动画：同一动画且正在播放时幂等忽略（避免每帧重置导致循环卡在第 0 帧）；
   * 切不同动画或重播已结束的动画则从第 0 帧重新开始。
   */
  setAnimation(id: AnimationId): void {
    if (id === this.currentId && !this.finished) {
      return;
    }
    this.currentId = id;
    this.frameIndex = 0;
    this.accumulator = 0;
    this.finished = false;
  }

  /** 每渲染帧调用一次，dt 单位秒（调用方已钳制上限，SKILL §24 用计时不用 setTimeout） */
  update(dt: number): void {
    if (this.finished || dt <= 0) {
      return;
    }
    const def = this.def;
    const frameDuration = 1 / def.fps;
    this.accumulator += dt;
    while (this.accumulator >= frameDuration) {
      this.accumulator -= frameDuration;
      if (def.loop) {
        this.frameIndex = (this.frameIndex + 1) % def.frames;
      } else if (this.frameIndex + 1 >= def.frames) {
        // 一次性动画：钳制在最后一帧并回调一次
        this.frameIndex = def.frames - 1;
        this.finished = true;
        if (this.finishedHandler) {
          this.finishedHandler(this.currentId);
        }
        return;
      } else {
        this.frameIndex += 1;
      }
    }
  }
}
