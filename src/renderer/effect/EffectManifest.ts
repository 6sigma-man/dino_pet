/**
 * 特效清单（Phase 5：TECH_DESIGN §16 特效与主体解耦）。
 * 纯数据/纯函数模块：不依赖 DOM，可被 node --test 单测（tsconfig.unittest 编进 dist-unittest/）。
 * 约束（README_ASSETS.md）：effects/* 仅为**可选装饰叠加层**，fire/water 主体喷射由一体化角色帧承担，
 *   本层弹体是"飞出嘴外的火/水花"式 polish，不替代主体动画。
 * 生命周期（§16）：spawn → update → render → destroy；一次性特效播完自动 destroy（火焰不残留）。
 */

export type EffectName = 'fire' | 'water' | 'dust' | 'sparkle' | 'zzz';
export type EffectAnchor = 'mouth' | 'head' | 'feet' | 'center';

export interface EffectDefinition {
  name: EffectName;
  /** sprite=读 effects/<dir>/NN.png；text=程序绘制（zzz 无正式素材，用文字占位，不伪造 IP 美术） */
  kind: 'sprite' | 'text';
  /** sprite 子目录（相对 effects/） */
  dir?: string;
  frames?: number;
  fps?: number;
  /** true=持续到被 cancel（如睡眠 zzz）；false=播完自动销毁 */
  loop: boolean;
  anchor: EffectAnchor;
  /** 渲染尺寸（CSS px，窗口 128 坐标系内） */
  size: number;
  /** 沿朝向的飞行距离 px（嘴部弹体用；0=原地） */
  travel: number;
  /** text 内容（kind=text） */
  text?: string;
}

/**
 * 特效定义表。帧数与 effects/ 磁盘 PNG 数一致（每目录 6 帧，由单测校验）；
 * zzz 无对应素材目录 → kind=text 程序绘制（诚实占位，见 README 不做外部伪造）。
 */
export const EFFECTS: Record<EffectName, EffectDefinition> = {
  fire: { name: 'fire', kind: 'sprite', dir: 'fire', frames: 6, fps: 12, loop: false, anchor: 'mouth', size: 40, travel: 46 },
  water: { name: 'water', kind: 'sprite', dir: 'water', frames: 6, fps: 12, loop: false, anchor: 'mouth', size: 40, travel: 46 },
  dust: { name: 'dust', kind: 'sprite', dir: 'dust', frames: 6, fps: 12, loop: false, anchor: 'feet', size: 34, travel: 0 },
  sparkle: { name: 'sparkle', kind: 'sprite', dir: 'sparkle', frames: 6, fps: 10, loop: false, anchor: 'head', size: 40, travel: 0 },
  zzz: { name: 'zzz', kind: 'text', text: 'z', frames: 1, fps: 1, loop: true, anchor: 'head', size: 16, travel: 0 },
};

/** 校验清单（sprite 必须有 dir/frames/fps；text 必须有 text），返回问题列表（空=通过） */
export function validateEffects(defs: Record<EffectName, EffectDefinition> = EFFECTS): string[] {
  const issues: string[] = [];
  for (const [key, def] of Object.entries(defs)) {
    if (key !== def.name) {
      issues.push(`key/name mismatch: ${key} vs ${def.name}`);
    }
    if (def.kind === 'sprite') {
      if (!def.dir) issues.push(`${key}: sprite missing dir`);
      if (!def.frames || def.frames <= 0) issues.push(`${key}: invalid frames`);
      if (!def.fps || def.fps < 2) issues.push(`${key}: invalid fps`);
    } else if (def.kind === 'text') {
      if (!def.text) issues.push(`${key}: text effect missing text`);
    }
    if (def.size <= 0) issues.push(`${key}: size must be positive`);
  }
  return issues;
}
