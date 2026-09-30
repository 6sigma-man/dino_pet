/**
 * 恐龙画布渲染器（TECH_DESIGN §2 Dino Renderer / §14 SpriteRenderer）。
 * 职责：DPR 适配缩放（SKILL §25）、帧绘制、水平翻转（素材主方向朝左，03 接入文档第五阶段）、
 *       占位动画的程序化绘制（显式 placeholder 标识，T202）。
 * 不负责：帧计时推进（AnimationEngine）、资产加载（SpriteSheet）。
 */

/* 常量与 src/shared/constants.ts 手工同步（sandbox+ESM 隔离，见 project_process.md §1-5） */
const DINO_RENDER_SIZE = 96;

/** 特效锚点（与 effect/EffectManifest 手工同步，渲染层不依赖 effect 模块保持解耦） */
export type EffectAnchorPoint = 'mouth' | 'head' | 'feet' | 'center';

export interface EffectDrawOpts {
  anchor: EffectAnchorPoint;
  size: number;
  /** 沿朝向飞行距离 px */
  travel: number;
  /** 0..1 生命周期进度 */
  progress: number;
  /** 显示方向是否与素材主方向相反 */
  flipped: boolean;
  /** 透明度 0..1 */
  alpha: number;
}

/** 恐龙本体绘制框：窗口居中（窗口 = 恐龙 + 四周特效余量） */
function dinoBox(windowSize: number) {
  const origin = (windowSize - DINO_RENDER_SIZE) / 2;
  return { origin, size: DINO_RENDER_SIZE, center: windowSize / 2 };
}

export class DinoRenderer {
  private ctx: CanvasRenderingContext2D | null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly windowSize: number,
  ) {
    this.ctx = canvas.getContext('2d');
  }

  /** DPR 适配：位图尺寸 = CSS 尺寸 × dpr，绘制坐标仍用 CSS px（Phase 1 验证过的模式） */
  private beginFrame(): CanvasRenderingContext2D | null {
    if (!this.ctx) {
      return null;
    }
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(this.windowSize * dpr);
    if (this.canvas.width !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.windowSize, this.windowSize);
    return this.ctx;
  }

  /**
   * 绘制正式帧。flipped = 显示方向与素材主方向（朝左）相反时水平翻转。
   * img 为 null（加载失败/未就绪）时回退占位绘制，不静默（SKILL §27）。
   */
  drawFrame(img: HTMLImageElement | null, flipped: boolean, fallbackLabel: string): void {
    const ctx = this.beginFrame();
    if (!ctx) {
      return;
    }
    if (!img) {
      this.drawPlaceholderInternal(ctx, fallbackLabel);
      return;
    }
    const box = dinoBox(this.windowSize);
    ctx.save();
    if (flipped) {
      ctx.translate(box.center, 0);
      ctx.scale(-1, 1);
      ctx.translate(-box.center, 0);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, box.origin, box.origin, box.size, box.size);
    ctx.restore();
  }

  /** 占位动画渲染（manifest placeholder:true 或加载失败）：程序恐龙 + 显式标识 */
  drawPlaceholder(label: string): void {
    const ctx = this.beginFrame();
    if (!ctx) {
      return;
    }
    this.drawPlaceholderInternal(ctx, label);
  }

  /* ------------------------------------------------------------------ */
  /* Phase 5：特效叠加层（与主体解耦；不 beginFrame/不清屏，叠加在本帧恐龙之上） */
  /* ------------------------------------------------------------------ */

  /** 锚点 → 窗口 CSS 坐标（front=朝向符号：素材朝右为 +1，翻转后 -1） */
  private anchorPoint(anchor: EffectAnchorPoint, flipped: boolean): { x: number; y: number; front: number } {
    const box = dinoBox(this.windowSize);
    const front = flipped ? -1 : 1;
    switch (anchor) {
      case 'mouth':
        return { x: box.center + front * box.size * 0.2, y: box.origin + box.size * 0.44, front };
      case 'head':
        return { x: box.center, y: box.origin + box.size * 0.08, front };
      case 'feet':
        return { x: box.center, y: box.origin + box.size * 0.94, front };
      case 'center':
        return { x: box.center, y: box.center, front };
    }
  }

  /** 绘制 sprite 特效（img 为空则跳过，不空白闪烁） */
  drawEffect(img: HTMLImageElement | null, o: EffectDrawOpts): void {
    const ctx = this.ctx;
    if (!ctx || !img) {
      return;
    }
    const p = this.anchorPoint(o.anchor, o.flipped);
    const x = p.x + p.front * o.progress * o.travel;
    const y = p.y;
    ctx.save();
    ctx.globalAlpha = o.alpha;
    ctx.imageSmoothingQuality = 'high';
    if (o.flipped) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }
    ctx.drawImage(img, x - o.size / 2, y - o.size / 2, o.size, o.size);
    ctx.restore();
  }

  /** 绘制 text 特效（zzz 等程序绘制，无正式素材时使用；不伪造 IP 美术） */
  drawEffectText(text: string, o: EffectDrawOpts): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    const p = this.anchorPoint(o.anchor, o.flipped);
    const x = p.x + p.front * o.progress * o.travel;
    const y = p.y;
    ctx.save();
    ctx.globalAlpha = o.alpha;
    ctx.fillStyle = '#eaf2ff';
    ctx.strokeStyle = 'rgba(60, 90, 150, 0.8)';
    ctx.lineWidth = 2;
    ctx.font = `bold ${o.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* 程序化占位恐龙（配色取自 DinoPet_AI_Asset_Pack_V1/01 §2） */
  /* ------------------------------------------------------------------ */
  private drawPlaceholderInternal(ctx: CanvasRenderingContext2D, label: string): void {
    const box = dinoBox(this.windowSize);
    const cx = box.center;
    const cy = box.center;
    const r = DINO_RENDER_SIZE / 2 - 6;

    // 背刺（深绿色）
    ctx.fillStyle = '#2e7d32';
    for (const [ox, oy, s] of [[-r + 2, -6, 12], [-r - 2, 8, 10], [r - 2, -6, 12]] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy + oy - s);
      ctx.lineTo(cx + ox + (ox < 0 ? 10 : -10), cy + oy);
      ctx.lineTo(cx + ox, cy + oy + 4);
      ctx.closePath();
      ctx.fill();
    }

    // 身体（浅绿色）
    ctx.fillStyle = '#8bc34a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // 腹部（奶油色）
    ctx.fillStyle = '#f5eedc';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.35, r * 0.55, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛（黑色大眼 + 高光）
    for (const ex of [cx - r * 0.38, cx + r * 0.38]) {
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.arc(ex, cy - r * 0.35, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + 2.5, cy - r * 0.35 - 2.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 嘴巴
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // 腮红（淡粉）
    ctx.fillStyle = 'rgba(244, 143, 177, 0.6)';
    for (const bx of [cx - r * 0.62, cx + r * 0.62]) {
      ctx.beginPath();
      ctx.ellipse(bx, cy + 2, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // placeholder 显式标识（T202：开发占位素材必须明确标识）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${label} placeholder`, cx, this.windowSize - 4);
  }
}
