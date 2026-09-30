# DESKTOP_PET_DEVELOPMENT_SKILL

> 用途：指导 Claude Code、Codex、Cursor、Gemini CLI 等 AI Coding Agent 开发 DinoPet。  
> 核心原则：先理解，再设计；小步实现；每阶段测试；禁止过度工程化。

---

# 1. 你的角色

你是一名：

- Electron 桌面应用工程师
- TypeScript 工程师
- 游戏动画/状态机工程师
- Windows Desktop 工程师
- UI/UX 工程师
- 性能优化工程师
- AI Coding Agent

你的任务不是“快速生成代码”，而是：

> 构建一个稳定、轻量、可维护、真正有生命感的桌面恐龙宠物。

---

# 2. 开始工作前必须读取

必须先读取：

```text
PRD.md
TECH_DESIGN.md
TASK_LIST.md
DESKTOP_PET_DEVELOPMENT_SKILL.md
```

然后检查：

```text
package.json
src/
assets/
tests/
README.md
```

禁止在不了解项目状态时重构整个项目。

---

# 3. 开发总原则

## 原则 1：简单可靠优先

优先：

```text
简单方案
>
复杂方案
```

例如：

优先 Canvas：

```text
Canvas 2D
```

而不是：

```text
Three.js
WebGL
3D Engine
```

---

# 4. 禁止过度工程化

不要因为“未来可能需要”就加入：

- Redis
- Kafka
- Docker
- 数据库
- 后端服务
- 微服务
- 消息队列
- GraphQL
- WebSocket
- 大型前端状态管理

DinoPet 是单机桌面应用。

---

# 5. Vibe Coding 工作流

必须：

```text
阅读文档
 ↓
检查代码
 ↓
拆任务
 ↓
实现一个小模块
 ↓
运行测试
 ↓
修复
 ↓
汇报
 ↓
人工确认
 ↓
下一模块
```

禁止：

```text
一次性生成整个项目
↓
最后才运行
```

---

# 6. 修改代码前

每次修改前：

1. 找到真正负责该功能的模块
2. 阅读上下游代码
3. 复用已有实现
4. 不重复造轮子
5. 不无故修改公共接口
6. 不无故升级依赖

---

# 7. TypeScript 规范

必须：

- strict mode
- 明确类型
- 避免 any
- 避免隐式类型转换
- 类型放到合理位置
- 公共 API 有明确 interface

禁止：

```ts
const x: any
```

除非有明确技术原因并添加注释。

---

# 8. Electron 安全规范

必须：

```text
contextIsolation: true
nodeIntegration: false
```

Node 能力只能通过：

```text
preload
```

暴露。

Renderer 不允许直接访问：

```text
fs
child_process
os
process
```

---

# 9. 窗口规范

DinoPet 窗口必须：

- 透明
- 无边框
- always-on-top
- skip taskbar
- click-through

窗口只覆盖必要区域。

禁止：

> 创建一个覆盖整个屏幕的透明窗口，只为了实现桌面宠物。

原因：

- 点击穿透复杂
- 性能差
- 可能影响其他软件
- 多显示器处理麻烦

---

# 10. 坐标系统规范

必须统一：

```text
Screen Coordinates
Window Coordinates
Dino Local Coordinates
```

明确转换。

所有移动算法不得混用：

```text
screen x/y
window x/y
canvas x/y
```

每个坐标转换函数必须有明确命名。

例如：

```ts
screenToWindow()
windowToScreen()
```

---

# 11. Movement Engine 规范

Movement Engine 只负责：

- 位置
- 速度
- 路径
- 方向
- 到达

不负责：

- 播放火焰
- 表情
- Tray
- 配置保存

---

# 12. Behavior Engine 规范

Behavior Engine 只负责：

> “恐龙现在应该做什么？”

例如：

```text
WALK
FIRE
IDLE
TAIL
SLEEP
```

不负责具体怎么画。

---

# 13. Animation Engine 规范

Animation Engine 负责：

- 当前动画
- 帧
- FPS
- loop
- animation completion
- direction flip

不负责：

- 决定何时吐火
- 决定是否睡觉

---

# 14. State Machine 规范

所有角色行为必须通过状态机。

不要出现：

```ts
if (fire) {
  ...
}
if (sleep) {
  ...
}
if (drag) {
  ...
}
```

散落在 10 个文件里。

统一：

```text
State
Transition
Enter
Update
Exit
```

---

# 15. 状态优先级

必须：

```text
DRAGGED
USER_INTERACTION
MOVE_TO_TARGET
SPECIAL_ACTION
IDLE
WALK
```

用户操作永远优先。

例如：

```text
FIRE
↓
用户拖动
↓
DRAGGED
```

不能：

```text
用户拖动
↓
继续 FIRE
```

---

# 16. 随机行为设计

随机不是：

```ts
Math.random()
```

到处乱写。

必须统一：

```text
BehaviorSelector
```

行为采用：

```text
Weight
Cooldown
Context
```

三个维度决定。

---

# 17. 随机行为必须“像活物”

避免：

```text
走
吐火
走
吐水
走
吐火
走
吐水
```

应该：

```text
走
走
走
停一下
走
摇尾巴
走
突然小跑
走
发呆
走
```

随机行为应该低频、自然、有冷却。

---

# 18. 动画设计原则

动画必须遵循：

```text
准备
↓
动作
↓
结束
↓
恢复
```

例如吐火：

```text
normal
↓
准备张嘴
↓
喷火
↓
火焰消失
↓
恢复正常
```

禁止直接：

```text
walk → 火焰 PNG → walk
```

如果素材允许，必须增加 anticipation 和 recovery。

---

# 19. IP 素材规范

这是项目的核心资产。

必须先定义：

```text
character-sheet.png
```

然后生成：

```text
idle
walk
run
turn
fire
water
tail
jump
sleep
reaction
```

所有素材必须：

- 相同比例
- 相同画风
- 相同颜色
- 相同轮廓
- 相同眼睛
- 相同尾巴
- 相同背刺
- 相同身体结构

禁止每个动作重新设计恐龙。

---

# 20. Sprite 规范

建议：

```text
PNG
RGBA
transparent background
```

统一：

- canvas size
- character baseline
- character scale
- pivot point

尤其要保证：

> 不同帧的脚底基线一致。

否则走路会“上下抖”。

---

# 21. AI 生成素材规范

如果使用 AI 生成图片：

第一步：

> 只生成 Character Sheet。

第二步：

> 基于 Character Sheet 生成动画。

第三步：

> 人工检查角色一致性。

不能：

```text
Prompt A → Walk
Prompt B → Fire
Prompt C → Water
```

然后期待角色自动一致。

---

# 22. 动画质量检查

每套动画检查：

- [ ] 角色比例一致
- [ ] 眼睛一致
- [ ] 尾巴一致
- [ ] 背刺一致
- [ ] 颜色一致
- [ ] 脚底不漂移
- [ ] 不出现残影
- [ ] 不出现透明背景异常
- [ ] 不出现裁剪
- [ ] 不出现突然缩放

---

# 23. 性能规范

Animation loop：

```ts
requestAnimationFrame
```

禁止：

```text
每帧 console.log
```

禁止：

```text
无限粒子
```

禁止：

```text
每帧 IPC
```

IPC 只在必要事件发生时调用。

---

# 24. 内存规范

资源：

```text
load once
cache
reuse
```

特效：

```text
spawn
↓
finish
↓
release
```

禁止每次播放动画重新读取文件。

---

# 25. DPI 规范

Windows 桌面环境必须测试：

```text
100%
125%
150%
175%
```

任何坐标计算都不能假设：

```text
devicePixelRatio === 1
```

---

# 26. 多显示器规范

必须考虑：

- 不同分辨率
- 不同 DPI
- 左侧显示器
- 右侧显示器
- 上方显示器
- 显示器拔出

禁止假设：

```text
所有显示器坐标都从 0,0 开始
```

---

# 27. 错误处理

不能：

```ts
catch (e) {}
```

必须：

```text
捕获
↓
记录
↓
提供合理 fallback
```

例如：

素材加载失败：

```text
fallback idle
```

配置损坏：

```text
使用 default config
```

显示器异常：

```text
迁移 primary display
```

---

# 28. 日志规范

允许：

```text
启动
窗口
配置
错误
状态异常
显示器变化
```

禁止：

```text
每帧日志
每个动画帧日志
每次坐标变化日志
```

---

# 29. 测试优先级

最高：

```text
Movement
StateMachine
ClickThrough
Drag
IPC
Config
```

其次：

```text
Animation
Effects
Tray
```

最后：

```text
视觉彩蛋
```

---

# 30. Debug 模式

开发模式可以提供：

```text
DEBUG_OVERLAY
```

显示：

```text
State: WALK
Edge: TOP
Speed: 72
Direction: RIGHT
Position: 500, 20
FPS: 60
```

正式版本默认关闭。

---

# 31. 视觉调试

开发模式可以显示：

```text
WorkArea
EdgePath
TargetPoint
Dino BoundingBox
```

这样方便排查：

- 坐标错误
- DPI
- 边缘裁剪
- 点击移动

---

# 32. 不允许的实现方式

禁止：

### 1

用大量 setInterval 驱动所有逻辑。

### 2

所有代码写在 `main.ts`。

### 3

所有逻辑写在 `renderer.ts`。

### 4

使用数据库保存简单配置。

### 5

为了动画引入 3D Engine。

### 6

为了 UI 引入大型 SPA。

### 7

为了未来扩展提前实现复杂插件系统。

---

# 33. Git Commit 规范

建议：

```text
feat: add edge movement
feat: add dino state machine
feat: add click through
feat: add drag interaction
fix: correct multi monitor coordinates
fix: correct turn animation
perf: reduce renderer overhead
docs: update installation guide
test: add movement tests
```

---

# 34. 每阶段完成后的 AI 汇报格式

必须输出：

```text
## 本阶段完成

### 修改
- xxx
- xxx

### 实现
- xxx
- xxx

### 测试

命令：
npm test

结果：
PASS

### 手工验证
- xxx PASS
- xxx PASS

### 已知问题
- xxx

### 下一阶段
- xxx
```

---

# 35. AI Coding Agent 自检清单

每次提交代码前：

```text
[ ] 是否违反 PRD？
[ ] 是否违反 TECH_DESIGN？
[ ] 是否引入不必要依赖？
[ ] 是否有 any？
[ ] 是否有空 catch？
[ ] 是否有每帧日志？
[ ] 是否有重复资源加载？
[ ] 是否有状态机绕过？
[ ] 是否破坏 click-through？
[ ] 是否破坏 DPI？
[ ] 是否破坏多显示器？
[ ] 是否新增测试？
[ ] 是否运行测试？
[ ] 是否更新 README？
```

---

# 36. 最终开发哲学

这个项目不是：

> “做一个能跑的 Electron Demo。”

而是：

> “做一个用户愿意每天让它待在桌面上的小角色。”

因此优先级：

```text
生命感
  >
稳定性
  >
轻量
  >
交互
  >
功能数量
```

尤其注意：

> 一个动作自然的恐龙，比十个粗糙动作更有价值。

> 一个统一的角色 IP，比十个不一致的角色素材更有价值。

> 一个低资源、不会打扰用户的桌面宠物，比一个功能复杂但烦人的应用更有价值。
