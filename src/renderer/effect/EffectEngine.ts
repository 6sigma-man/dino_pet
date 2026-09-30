/**
 * 特效引擎（Phase 5：TECH_DESIGN §16 生命周期 spawn→update→render→destroy）。
 * 纯逻辑模块：不依赖 DOM/Electron，可被 node --test 单测。只管"哪些特效、第几帧、透明度"，
 * 实际取图与绘制在 EffectPlayer（资产侧）+ DinoRenderer（绘制侧），保持主体/特效解耦。
 */
import type { EffectDefinition, EffectName } from './EffectManifest.js';

export interface EffectInstance {
  def: EffectDefinition;
  /** 已播时间秒 */
  t: number;
  /** 当前帧（0 基） */
  frame: number;
  /** 一次性特效播完标记（下次 update 前被 prune） */
  done: boolean;
}

/** 供渲染层消费的一帧描述 */
export interface EffectRenderable {
  name: EffectName;
  def: EffectDefinition;
  frame: number;
  /** 0..1 生命周期进度（弹体飞行/淡出用） */
  progress: number;
  /** 透明度 0..1（尾段淡出） */
  alpha: number;
}

export class EffectEngine {
  private instances: EffectInstance[] = [];

  constructor(private readonly defs: Record<EffectName, EffectDefinition>) {}

  /**
   * 生成特效。loop 型（zzz）幂等：同名已在场则不重复叠加。
   * 一次性型允许多实例（连续触发各自独立销毁）。
   */
  spawn(name: EffectName): void {
    const def = this.defs[name];
    if (def.loop && this.instances.some((i) => i.def.name === name)) {
      return;
    }
    this.instances.push({ def, t: 0, frame: 0, done: false });
  }

  /** 主动取消（如离开 SLEEP 收回 zzz）；不影响一次性特效 */
  cancel(name: EffectName): void {
    this.instances = this.instances.filter((i) => i.def.name !== name);
  }

  has(name: EffectName): boolean {
    return this.instances.some((i) => i.def.name === name && !i.done);
  }

  get activeCount(): number {
    return this.instances.filter((i) => !i.done).length;
  }

  /** 每帧推进；一次性特效播完即 done（→ 火焰不残留，T501 验收） */
  update(dt: number): void {
    if (dt <= 0) {
      return;
    }
    for (const inst of this.instances) {
      inst.t += dt;
      const frames = inst.def.frames ?? 1;
      const fps = inst.def.fps ?? 1;
      if (inst.def.loop) {
        inst.frame = Math.floor(inst.t * fps) % frames;
      } else {
        const idx = Math.floor(inst.t * fps);
        if (idx >= frames) {
          inst.done = true;
          inst.frame = frames - 1;
        } else {
          inst.frame = idx;
        }
      }
    }
    // destroy：移除已完成的一次性实例
    this.instances = this.instances.filter((i) => !i.done);
  }

  /** 当前应绘制的特效帧 */
  renderables(): EffectRenderable[] {
    return this.instances.map((inst) => {
      const def = inst.def;
      const frames = def.frames ?? 1;
      const fps = def.fps ?? 1;
      const life = frames / fps;
      const progress = def.loop ? 0 : Math.min(1, inst.t / life);
      // 一次性特效尾段（后 25%）淡出，进一步避免"残留"观感
      const alpha = def.loop ? 1 : progress > 0.75 ? Math.max(0, (1 - progress) / 0.25) : 1;
      return { name: def.name, def, frame: inst.frame, progress, alpha };
    });
  }
}
