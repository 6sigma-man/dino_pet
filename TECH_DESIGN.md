# DinoPet 技术概要设计文档

> 版本：V1.0  
> 技术路线：Electron + TypeScript + HTML/CSS + Canvas/Sprite  
> 原则：简单可靠优先，不为桌面宠物引入复杂架构。

---

# 1. 技术选型

## 1.1 核心

- Node.js 20+
- Electron
- TypeScript
- HTML5
- CSS
- Canvas 2D 或轻量 DOM/Sprite Renderer
- npm

## 1.2 明确不使用

V1 不使用：

- React
- Vue
- Angular
- Redux
- Zustand
- Three.js
- WebGL 3D
- WebSocket
- Redis
- Kafka
- 数据库
- 后端服务
- 云服务

理由：

> DinoPet 是单机桌面小工具，复杂基础设施只会增加安装、调试和资源开销。

---

# 2. 总体架构

```text
Electron Main Process
│
├── Window Manager
├── Screen Manager
├── Tray Manager
├── Config Manager
└── IPC
      │
      ↓
Renderer Process
│
├── Dino Controller
├── Movement Engine
├── Behavior Engine
├── Animation Engine
├── Interaction Manager
└── Renderer
```

---

# 3. 目录结构

```text
desktop-pet-dino/
│
├── src/
│   ├── main/
│   │   ├── main.ts
│   │   ├── window-manager.ts
│   │   ├── tray-manager.ts
│   │   ├── screen-manager.ts
│   │   ├── ipc-manager.ts
│   │   └── config-manager.ts
│   │
│   ├── renderer/
│   │   ├── index.html
│   │   ├── app.ts
│   │   ├── core/
│   │   │   ├── Dino.ts
│   │   │   ├── DinoController.ts
│   │   │   └── GameLoop.ts
│   │   │
│   │   ├── movement/
│   │   │   ├── MovementEngine.ts
│   │   │   ├── EdgePath.ts
│   │   │   ├── TargetMovement.ts
│   │   │   └── Vector.ts
│   │   │
│   │   ├── behavior/
│   │   │   ├── BehaviorEngine.ts
│   │   │   ├── BehaviorState.ts
│   │   │   └── BehaviorSelector.ts
│   │   │
│   │   ├── animation/
│   │   │   ├── AnimationEngine.ts
│   │   │   ├── SpriteSheet.ts
│   │   │   └── AnimationDefinition.ts
│   │   │
│   │   ├── interaction/
│   │   │   ├── DragController.ts
│   │   │   ├── ClickController.ts
│   │   │   └── HitTest.ts
│   │   │
│   │   └── renderer/
│   │       └── DinoRenderer.ts
│   │
│   ├── shared/
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   └── config-schema.ts
│   │
│   └── preload/
│       └── preload.ts
│
├── assets/
│   ├── dino/
│   │   ├── character-sheet.png
│   │   ├── animations/
│   │   │   ├── idle/
│   │   │   ├── walk/
│   │   │   ├── run/
│   │   │   ├── turn/
│   │   │   ├── fire/
│   │   │   ├── water/
│   │   │   ├── tail/
│   │   │   ├── jump/
│   │   │   ├── sleep/
│   │   │   └── reaction/
│   │   └── effects/
│   │
│   └── tray/
│
├── config/
│   └── default-config.json
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── scripts/
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

---

# 4. Electron 窗口设计

## 4.1 主窗口

要求：

- transparent: true
- frame: false
- resizable: false
- movable: true/根据架构需要
- alwaysOnTop: true
- skipTaskbar: true
- backgroundColor: transparent
- show: false → 初始化完成后 show

窗口尺寸只覆盖恐龙及少量特效区域，不要创建一个覆盖整个屏幕的大窗口。

---

# 5. 点击穿透设计

Electron 主进程根据状态控制：

```text
setIgnoreMouseEvents(true, { forward: true })
```

正常状态：

```text
click-through = true
```

交互状态：

```text
click-through = false
```

状态：

```text
PASSIVE
INTERACTIVE
DRAGGING
```

切换规则：

```text
PASSIVE
 ↓ 用户需要交互
INTERACTIVE
 ↓ 拖动
DRAGGING
 ↓ 松手
PASSIVE
```

注意：

如果窗口非常小且只包住恐龙，可以通过窗口区域控制降低交互冲突。

---

# 6. 窗口位置模型

定义：

```ts
interface DinoPosition {
  x: number;
  y: number;
}
```

定义工作区：

```ts
interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

恐龙边缘路径不能直接使用整个屏幕边界。

必须考虑：

```text
workArea
+
dinoWidth
+
dinoHeight
+
edgeMargin
```

避免恐龙一半被屏幕裁掉。

---

# 7. 四边路径算法

## 7.1 路径抽象

定义：

```ts
enum Edge {
  TOP,
  RIGHT,
  BOTTOM,
  LEFT
}
```

定义：

```ts
enum DirectionMode {
  CLOCKWISE,
  COUNTERCLOCKWISE,
  RANDOM
}
```

每条边是一个线段：

```text
TOP:
(xMin, yMin) → (xMax, yMin)

RIGHT:
(xMax, yMin) → (xMax, yMax)

BOTTOM:
(xMax, yMax) → (xMin, yMax)

LEFT:
(xMin, yMax) → (xMin, yMin)
```

---

# 8. 转角处理

不能：

```text
到终点
↓
瞬移
↓
下一边
```

必须：

```text
WALK
 ↓
TURN
 ↓
改变方向
 ↓
WALK
```

Turn 动画负责视觉表现。

---

# 9. 移动循环

推荐：

```ts
requestAnimationFrame(loop)
```

不要使用：

```ts
setInterval(..., 16)
```

作为主要动画循环。

每帧计算：

```text
deltaTime
↓
当前状态
↓
当前速度
↓
当前位置
↓
路径进度
↓
动画帧
↓
渲染
```

---

# 10. 行为状态机

核心：

```ts
enum DinoState {
  IDLE,
  WALK,
  RUN,
  TURN,
  FIRE,
  WATER,
  TAIL,
  JUMP,
  SLEEP,
  REACTION,
  DRAGGED,
  MOVE_TO_TARGET
}
```

状态必须具有：

```ts
enter()
update(deltaTime)
exit()
```

例如：

```text
WALK
 ├── update
 ├── behavior check
 └── transition

FIRE
 ├── play animation
 ├── effect
 └── return WALK
```

---

# 11. 状态优先级

高优先级必须打断低优先级：

```text
DRAGGED
  >
USER_INTERACTION
  >
MOVE_TO_TARGET
  >
SPECIAL_ACTION
  >
IDLE
  >
WALK
```

例如：

```text
WALK
 ↓
FIRE
 ↓
用户开始拖动
 ↓
立即进入 DRAGGED
```

---

# 12. 行为选择器

不要：

```ts
if (Math.random() < 0.1) ...
```

散落在各种代码里。

统一：

```ts
BehaviorSelector
```

输入：

```ts
BehaviorContext
```

输出：

```ts
BehaviorType
```

例如：

```ts
interface BehaviorContext {
  currentState: DinoState;
  timeSinceLastAction: number;
  userInteracting: boolean;
  speed: number;
  mood: Mood;
}
```

---

# 13. 行为冷却

每个特殊行为支持 cooldown：

```text
fire cooldown
water cooldown
jump cooldown
tail cooldown
```

避免：

```text
🔥
↓
🔥
↓
🔥
↓
🔥
```

造成行为异常。

---

# 14. 动画系统

定义：

```ts
interface AnimationDefinition {
  id: string;
  frames: string[];
  fps: number;
  loop: boolean;
  scale: number;
}
```

例如：

```json
{
  "id": "walk",
  "frames": [
    "01.png",
    "02.png",
    "03.png",
    "04.png"
  ],
  "fps": 10,
  "loop": true
}
```

---

# 15. Sprite 渲染

推荐优先：

- Canvas 2D

原因：

- 控制简单
- 动画容易
- 粒子容易
- 不需要复杂 DOM
- 对小型桌面宠物足够

如果实际测试发现 DOM/CSS Sprite 已经满足性能要求，可以采用 DOM；但必须保持 Renderer 接口抽象，不让上层依赖具体渲染方式。

---

# 16. 特效

特效与恐龙主体解耦：

```text
Dino
 +
Effect
```

支持：

- fire
- water
- sparkle
- dust
- zzz
- hit
- sweat

特效生命周期：

```text
spawn
↓
update
↓
render
↓
destroy
```

---

# 17. 点击移动

点击桌面后：

```text
screenPoint
↓
validate
↓
targetPoint
↓
TargetMovement
↓
move
↓
arrival
↓
IDLE
```

V1 不实现复杂障碍物寻路。

如果目标点距离较远：

```text
速度降低
```

体现“慢慢走过去”的感觉。

---

# 18. 拖动

拖动需要保存：

```ts
dragOffsetX
dragOffsetY
```

而不是让恐龙中心瞬间跳到鼠标位置。

流程：

```text
mousedown
↓
calculate offset
↓
DRAGGED
↓
mousemove
↓
set position
↓
mouseup
↓
PASSIVE
```

---

# 19. 配置

建议：

```ts
interface DinoConfig {
  directionMode: DirectionMode;
  speedMode: SpeedMode;
  behaviorMode: BehaviorMode;
  clickThrough: boolean;
  nightMode: boolean;
  autoStart: boolean;
  monitorId?: string;
  weights: BehaviorWeights;
}
```

配置文件位置使用 Electron `app.getPath('userData')`。

禁止写入项目目录。

---

# 20. IPC

只允许 preload 暴露必要 API：

```ts
window.dinoAPI
```

例如：

```ts
getConfig()
saveConfig()
setClickThrough()
getDisplays()
setPause()
quit()
```

禁止 renderer 直接访问 Node API。

---

# 21. 多显示器

使用：

```ts
screen.getAllDisplays()
screen.getPrimaryDisplay()
```

监听：

- display-added
- display-removed
- display-metrics-changed

如果显示器消失：

```text
当前 Dino 所在显示器不存在
↓
自动迁移到主显示器
```

---

# 22. 系统托盘

Tray Manager 负责：

- 创建 Tray
- Context Menu
- Pause
- Resume
- Direction
- Speed
- Behavior
- Settings
- Exit

Tray 与 DinoController 解耦。

通过事件通信。

---

# 23. 开机启动

V1 使用 Electron 官方能力，例如：

```ts
app.setLoginItemSettings(...)
```

默认关闭。

由用户主动开启。

---

# 24. 安全

Electron 配置：

- contextIsolation: true
- nodeIntegration: false
- preload bridge
- 不加载远程网页
- 不执行远程脚本
- 不使用 eval
- 不引入未知远程资源

---

# 25. 日志

提供轻量 logger：

```text
INFO
WARN
ERROR
DEBUG
```

默认：

```text
INFO
```

开发模式：

```text
DEBUG
```

日志不能每帧输出。

禁止在 animation loop 中打印日志。

---

# 26. 测试

## Unit

测试：

- 四边路径
- 顺时针
- 逆时针
- 随机方向
- 坐标转换
- 行为权重
- cooldown
- 状态转换
- 配置序列化

## Integration

测试：

- Electron 启动
- Tray
- IPC
- 配置保存
- Pause
- Resume

## Manual

必须实际测试：

- 单显示器
- 双显示器
- 100% DPI
- 125% DPI
- 150% DPI
- 任务栏位置
- 最大化窗口
- 全屏程序
- 拖动
- 点击穿透

---

# 27. npm 命令

至少：

```bash
npm install
npm run dev
npm start
npm run build
npm test
npm run lint
```

可选：

```bash
npm run package
npm run release
```

---

# 28. GitHub 发布

README 必须包含：

```text
Features
Demo
Requirements
Install
Run
Build
Controls
Configuration
Development
Project Structure
Contributing
License
```

用户最少能够：

```bash
git clone <repo>
cd desktop-pet-dino
npm ci
npm start
```

启动。

---

# 29. 架构约束

必须遵守：

1. 不做过度设计
2. 不引入数据库
3. 不引入后端
4. 不引入复杂前端框架
5. 行为和动画解耦
6. 窗口和角色逻辑解耦
7. 所有配置集中管理
8. 所有坐标使用统一坐标系统
9. 所有状态通过状态机切换
10. 不允许一个超大文件承载整个应用
