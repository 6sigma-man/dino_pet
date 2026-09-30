# Claude Code / Codex / Cursor：DinoPet 美术资产接入任务 V1.0

你现在负责把 DinoPet 美术资产接入 Electron 桌面宠物项目。

## 先读这些文档

必须先读取：

- PRD.md
- TECH_DESIGN.md
- TASK_LIST.md
- DESKTOP_PET_DEVELOPMENT_SKILL.md
- 01_CHARACTER_ASSET_SPEC.md

不要直接开始大规模修改代码。

---

# 第一阶段：检查项目

检查：

- Electron
- TypeScript
- renderer
- preload
- main process
- Canvas/Sprite renderer
- 现有 assets
- package.json

输出：

1. 当前项目结构
2. 已完成内容
3. 缺失内容
4. 美术资产应该放在哪里

不要自行引入 React/Vue/Three.js。

---

# 第二阶段：建立资产目录

创建：

assets/dino/
assets/dino/idle/
assets/dino/walk/
assets/dino/run/
assets/dino/turn/
assets/dino/fire/
assets/dino/water/
assets/dino/tail/
assets/dino/jump/
assets/dino/sleep/
assets/dino/reaction/

effects/fire/
effects/water/
effects/dust/
effects/sparkle/

---

# 第三阶段：实现 Animation Controller

设计一个简单可靠的动画控制器。

至少支持：

```text
setAnimation("idle")
setAnimation("walk")
setAnimation("run")
setAnimation("turn")
setAnimation("fire")
setAnimation("water")
setAnimation("tail")
setAnimation("jump")
setAnimation("sleep")
setAnimation("reaction")
```

动画控制器负责：

- 帧播放
- FPS
- 循环
- 一次性动画
- 动画结束回调
- 当前帧
- 方向翻转

---

# 第四阶段：实现方向

优先只制作：

> 面向右侧

左侧：

> 使用水平翻转

不要为了左右方向生成两套完全相同的资源。

---

# 第五阶段：实现吐火

这是验收重点。

Fire 必须是：

idle
→ prepare
→ mouth_open
→ fire
→ fire_max
→ fire_end
→ mouth_close
→ previous_state

必须确认：

> 火焰视觉上来自嘴巴内部。

如果当前资源无法做到这一点：

不要用代码强行把火焰贴到嘴边假装完成。

应该报告：

> 缺少正确 Fire 资产，需要重新生成动画帧。

---

# 第六阶段：实现吐水

同 Fire。

必须表现：

> 嘴巴打开 → 水从嘴巴内部喷出 → 水流增强 → 水流结束 → 嘴巴关闭

---

# 第七阶段：行为系统

动画不是随机乱播。

建议：

walk：
持续时间较长

idle：
随机触发

tail：
低概率

fire：
低概率

water：
低概率

jump：
低概率

reaction：
鼠标触发

sleep：
长时间无互动后进入

---

# 第八阶段：资产调试页面

增加开发模式：

```text
Animation Debug
----------------
Idle
Walk
Run
Turn
Fire
Water
Tail
Jump
Sleep
Reaction
```

点击按钮即可播放对应动画。

同时显示：

```text
Animation: fire
Frame: 6/10
FPS: 12
Direction: right
```

---

# 第九阶段：验收

必须人工检查：

## Fire

- 嘴巴有没有张开？
- 火是不是从嘴里出来？
- 火焰是否连续？
- 结束后嘴巴是否恢复？

## Water

- 嘴巴有没有张开？
- 水是不是从嘴里出来？
- 水流是否连续？
- 结束后嘴巴是否恢复？

## 普通动画

- walk 是否自然？
- run 是否明显比 walk 快？
- turn 是否自然？
- tail 是否自然？
- sleep 是否有呼吸感？

---

# 第十阶段：每个模块完成后测试

每完成一个模块：

1. 启动项目
2. 测试功能
3. 检查控制台
4. 检查资源加载
5. 检查透明窗口
6. 检查点击穿透
7. 检查动画帧
8. 报告测试结果

不要一次性生成整个项目后再测试。

---

# 禁止

禁止：

- 为了动画引入大型游戏引擎
- React/Vue 只为了动画
- Three.js
- WebSocket
- Redis
- Kafka
- 数据库
- 微服务
- 后端服务
- 复杂 ECS
- 过度抽象

V1 原则：

> Electron + TypeScript + Canvas/Sprite + PNG

简单可靠优先。

---

# 最终验收标准

用户看到 Dino 时应该感觉：

> “这是一只真的住在我桌面上的小恐龙。”

而不是：

> “这是一个网页图片在移动。”
