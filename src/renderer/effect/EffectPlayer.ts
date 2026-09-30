/**
 * 特效播放器（Phase 5 资产侧胶水，TECH_DESIGN §16）。
 * 职责：一次性预加载 effects/ 精灵帧常驻缓存 + 委托纯逻辑 EffectEngine 推进生命周期 +
 *       把当前应绘制的特效解析为 { def, img|text, frame, progress, alpha } 交给 DinoRenderer 叠加绘制。
 * 不负责：绘制几何（DinoRenderer）、状态判定（app 决定何时 spawn/cancel）。
 */
import { SpriteSheet, EFFECT_ASSET_BASE } from '../asset/SpriteSheet.js';
import { EffectEngine, type EffectRenderable } from './EffectEngine.js';
import { EFFECTS, type EffectName } from './EffectManifest.js';

export interface EffectDrawItem {
  renderable: EffectRenderable;
  /** sprite 型当前帧图片（未就绪=null → 播放器已在 renderables 过滤，理论不出现） */
  img: HTMLImageElement | null;
}

export class EffectPlayer {
  private readonly engine = new EffectEngine(EFFECTS);
  private readonly sheets = new Map<EffectName, SpriteSheet>();

  constructor() {
    for (const def of Object.values(EFFECTS)) {
      if (def.kind === 'sprite' && def.dir) {
        this.sheets.set(def.name, new SpriteSheet(def.dir, def.frames ?? 0, EFFECT_ASSET_BASE));
      }
    }
  }

  /** 预加载全部 sprite 特效帧；text 型无需加载。resolve 失败清单（空=全成功） */
  async preload(): Promise<EffectName[]> {
    const jobs: Promise<EffectName | true>[] = [];
    for (const [name, sheet] of this.sheets) {
      jobs.push(sheet.preload().then((ok) => ok || name));
    }
    const results = await Promise.all(jobs);
    return results.filter((r): r is EffectName => r !== true);
  }

  spawn(name: EffectName): void {
    this.engine.spawn(name);
  }

  cancel(name: EffectName): void {
    this.engine.cancel(name);
  }

  update(dt: number): void {
    this.engine.update(dt);
  }

  /** 是否有活动中的特效（供主循环按需重绘：有特效时每帧刷新叠加，无特效且主体未变时可跳过整面重绘） */
  hasActive(): boolean {
    return this.engine.renderables().length > 0;
  }

  /** 当前应绘制的特效（sprite 未就绪的跳过，避免空白闪烁；text 型直接给） */
  current(): EffectDrawItem[] {
    const out: EffectDrawItem[] = [];
    for (const r of this.engine.renderables()) {
      if (r.def.kind === 'sprite') {
        const sheet = this.sheets.get(r.name);
        const img = sheet ? sheet.get(r.frame) : null;
        if (!img) {
          continue; // 素材缺失/未就绪：静默跳过该叠加层（主体动画仍在，不影响技能可见性）
        }
        out.push({ renderable: r, img });
      } else {
        out.push({ renderable: r, img: null });
      }
    }
    return out;
  }
}
