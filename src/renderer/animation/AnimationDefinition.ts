/**
 * 动画定义类型与清单校验（TECH_DESIGN §14）。
 * 纯类型/纯函数模块：不依赖 DOM 与 Electron，可被 node --test 直接单测。
 */

export type AnimationId =
  | 'idle'
  | 'walk'
  | 'run'
  | 'turn'
  | 'fire'
  | 'water'
  | 'tail'
  | 'jump'
  | 'sleep'
  | 'reaction';

export interface AnimationDefinition {
  id: AnimationId;
  /** 资产子目录：assets/dino/<dir>/NN.png */
  dir: string;
  /** 帧数（与磁盘 PNG 数一致，由单测校验） */
  frames: number;
  /** 建议 8~12（素材包规范：桌面宠物场景） */
  fps: number;
  loop: boolean;
  /** true = 正式 IP 帧未到位，运行时渲染程序占位图并显式标识 placeholder */
  placeholder: boolean;
}

/** 校验清单合法性，返回问题列表（空数组 = 通过） */
export function validateManifest(
  defs: Record<AnimationId, AnimationDefinition>,
): string[] {
  const issues: string[] = [];
  for (const [key, def] of Object.entries(defs)) {
    if (key !== def.id) {
      issues.push(`key/id mismatch: ${key} vs ${def.id}`);
    }
    if (!Number.isInteger(def.frames) || def.frames <= 0) {
      issues.push(`${key}: invalid frames ${def.frames}`);
    }
    if (def.fps < 2 || def.fps > 30) {
      issues.push(`${key}: fps ${def.fps} out of sane range 2~30`);
    }
    if (!def.dir) {
      issues.push(`${key}: empty dir`);
    }
  }
  return issues;
}
