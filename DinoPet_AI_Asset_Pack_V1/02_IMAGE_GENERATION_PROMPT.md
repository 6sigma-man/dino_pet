# DinoPet AI 美术生成总提示词 V1.0

你现在负责为 DinoPet 生成完整的桌面宠物动画资产。

## 最高优先级

不要重新设计角色。

必须严格参考：

> `character-sheet.png`

所有动画必须看起来像同一个角色。

角色：

> Dino，一只调皮活泼的Q版小暴龙桌面宠物。

视觉风格：

- cute cartoon
- energetic
- playful
- rounded
- colorful
- polished game mascot
- clean silhouette
- expressive face
- suitable for desktop pet
- transparent background

---

# 第一阶段：角色母版

如果 `character-sheet.png` 已经存在：

> 直接以它作为唯一视觉母版。

不要重新生成新的角色设计。

如果不存在：

先生成角色母版，必须包含：

- 正面
- 侧面
- 背面
- 3/4
- 开心
- 惊讶
- 生气
- 害羞
- 疑惑
- 大笑
- 睡觉
- 眨眼

---

# 第二阶段：动画资产

严格按照以下顺序生成：

1. idle
2. walk
3. run
4. turn
5. fire
6. water
7. tail
8. jump
9. sleep
10. reaction

一次只生成一组动画。

---

# Fire：吐火

这是重点动画。

Dino 必须：

1. 准备
2. 身体前倾
3. 嘴巴张开
4. 嘴巴进一步张大
5. 嘴巴完全张开
6. 从嘴巴内部吐出火焰
7. 火焰持续喷射
8. 火焰达到最大
9. 火焰缩小
10. 嘴巴关闭

必须保证：

> 火焰的源头位于 Dino 的口腔内部。

禁止：

> 把火焰作为独立贴图固定在嘴巴前面。

---

# Water：吐水

动作：

1. 准备
2. 身体前倾
3. 嘴巴张开
4. 嘴巴进一步张大
5. 嘴巴完全张开
6. 水从口腔内部喷出
7. 水流增强
8. 水流达到最大
9. 水流缩小
10. 嘴巴关闭

必须保证：

> 水流源头位于 Dino 的口腔内部。

---

# Walking

Dino 应该有明显的：

- 左右脚交替
- 手臂摆动
- 身体上下轻微起伏
- 尾巴自然摆动
- 头部轻微运动

不是简单移动一张静态图片。

---

# Run

相比 walk：

- 步频更快
- 身体前倾
- 手脚动作更明显
- 尾巴快速摆动
- 表情更兴奋

---

# Turn

不要使用生硬的90度瞬间旋转。

应该：

1. 减速
2. 身体转动
3. 尾巴跟随
4. 面向新方向
5. 恢复行走

---

# Tail

Dino 开心地摇尾巴：

- 身体保持稳定
- 尾巴左右摆动
- 眼睛/表情可以轻微变化
- 动作要有节奏

---

# Jump

必须表现：

- 蓄力
- 起跳
- 空中
- 下落
- 落地
- 小幅回弹

---

# Sleep

必须表现：

- 趴下
- 闭眼
- 呼吸
- Z
- 身体轻微起伏

---

# 输出规范

每个动画：

- PNG
- RGBA
- transparent background
- same canvas size
- same pivot
- same baseline
- no text
- no border
- no environment
- no floor
- no background

推荐：

> 256×256

---

# 重要

不要一次把所有动画混在一张图里。

程序需要独立帧。

优先输出：

> 单帧 PNG

如果工具只能生成 sprite sheet：

> 使用严格规则排列，并同时提供帧顺序说明。

---

# 最终目标

这些图片最终会被 Electron Canvas/Sprite 动画系统读取。

所以：

> 角色一致性 > 动画数量 > 特效复杂度

宁可少几个动作，也不要角色发生漂移。
