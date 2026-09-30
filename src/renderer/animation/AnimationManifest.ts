/**
 * 动画清单（数据模块，集中配置——禁止把帧数/FPS 散落各处，SKILL §29-7）。
 * 帧数必须与 assets/dino/<dir>/ 下 PNG 文件数一致（单测强校验）。
 * 素材来源：DinoPet Final Asset Pack（根目录 README_ASSETS.md + asset-manifest.json，
 * 2026-09-29 补齐全部 10 组）；本清单与 asset-manifest.json 的一致性由单测校验。
 */
import type { AnimationDefinition, AnimationId } from './AnimationDefinition.js';

/** 素材主方向：Final Asset Pack 全部朝右绘制，朝左用 Canvas 水平镜像（README_ASSETS.md） */
export const DINO_SOURCE_FACING: 'left' | 'right' = 'right';

export const ANIMATIONS: Record<AnimationId, AnimationDefinition> = {
  idle: { id: 'idle', dir: 'idle', frames: 6, fps: 8, loop: true, placeholder: false },
  walk: { id: 'walk', dir: 'walk', frames: 8, fps: 10, loop: true, placeholder: false },
  run: { id: 'run', dir: 'run', frames: 8, fps: 14, loop: true, placeholder: false },
  turn: { id: 'turn', dir: 'turn', frames: 5, fps: 10, loop: false, placeholder: false },
  fire: { id: 'fire', dir: 'fire', frames: 10, fps: 12, loop: false, placeholder: false },
  water: { id: 'water', dir: 'water', frames: 10, fps: 12, loop: false, placeholder: false },
  tail: { id: 'tail', dir: 'tail', frames: 8, fps: 10, loop: false, placeholder: false },
  jump: { id: 'jump', dir: 'jump', frames: 8, fps: 12, loop: false, placeholder: false },
  sleep: { id: 'sleep', dir: 'sleep', frames: 6, fps: 5, loop: true, placeholder: false },
  reaction: { id: 'reaction', dir: 'reaction', frames: 8, fps: 12, loop: false, placeholder: false },
};
