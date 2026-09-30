/**
 * 精灵图加载与缓存（TECH_DESIGN §14 SpriteRenderer 的资产侧）。
 * 每组动画一次性加载全部帧（≤10 张 256px PNG，总量很小，加载后常驻缓存，SKILL §24 禁止播放中再 IO）。
 * 加载失败：console 日志 + ok=false，由 DinoRenderer 回退占位绘制（SKILL §27 禁止静默吞错）。
 */

/** 相对 src/renderer/index.html 的资产根路径（assets/effects 均在工程根目录） */
export const DINO_ASSET_BASE = '../../assets/dino/';
export const EFFECT_ASSET_BASE = '../../effects/';

/** 帧文件命名规范：NN.png 从 01 开始（素材包 02_IMAGE_GENERATION_PROMPT.md） */
export function frameUrl(dir: string, frameOneBased: number, base: string = DINO_ASSET_BASE): string {
  return `${base}${dir}/${String(frameOneBased).padStart(2, '0')}.png`;
}

export class SpriteSheet {
  private images: HTMLImageElement[] = [];
  private loaded = false;
  private failed = false;

  constructor(
    private readonly dir: string,
    private readonly frameCount: number,
    private readonly base: string = DINO_ASSET_BASE,
  ) {}

  /** 预加载全部帧，resolve 是否全部成功 */
  preload(): Promise<boolean> {
    const jobs: Promise<void>[] = [];
    for (let i = 1; i <= this.frameCount; i++) {
      const img = new Image();
      const url = frameUrl(this.dir, i, this.base);
      jobs.push(
        new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => {
            console.error(`[ERROR] sprite load failed: ${url}`);
            reject(new Error(url));
          };
          img.src = url;
        }),
      );
      this.images.push(img);
    }
    return Promise.all(jobs)
      .then(() => {
        this.loaded = true;
        return true;
      })
      .catch(() => {
        this.failed = true;
        return false;
      });
  }

  /** 全部帧就绪且无失败 */
  get ok(): boolean {
    return this.loaded && !this.failed;
  }

  /** 取帧图片（0 基索引）；越界或未就绪返回 null，调用方走占位渲染 */
  get(frameIndex: number): HTMLImageElement | null {
    if (!this.ok || frameIndex < 0 || frameIndex >= this.frameCount) {
      return null;
    }
    return this.images[frameIndex];
  }
}
