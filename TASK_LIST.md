# DinoPet 开发任务列表

> 开发模式：阶段化 Vibe Coding  
> 原则：每完成一个阶段必须测试；每个模块完成后人工确认，再进入下一阶段。  
> AI Coding Agent 不允许一次性生成整个项目后再测试。

---

# 0. 开发规则

AI Agent 必须：

1. 先阅读：
   - PRD.md
   - TECH_DESIGN.md
   - DESKTOP_PET_DEVELOPMENT_SKILL.md
2. 检查当前项目实际状态
3. 不擅自修改技术栈
4. 每个阶段只实现当前阶段
5. 修改后立即运行测试
6. 发现问题先修复，再进入下一阶段
7. 不为了完成任务引入不必要依赖
8. 不生成假功能
9. 不用 TODO 代替核心实现
10. 每个阶段完成后输出：
   - 修改文件
   - 实现内容
   - 测试命令
   - 测试结果
   - 已知问题
   - 下一阶段建议

---

# Phase 0：项目初始化

## T001 初始化 Git

- 创建 Git 仓库
- 创建 `.gitignore`
- 创建 LICENSE
- 创建 README

验收：

- Git 状态正常
- Node 版本符合要求

---

## T002 初始化 npm

创建：

```text
package.json
tsconfig.json
```

脚本：

```text
npm run dev
npm start
npm run build
npm test
npm run lint
```

---

## T003 初始化 Electron

实现：

- Main Process
- Preload
- Renderer

验收：

```bash
npm install
npm run dev
```

出现基础窗口。

---

# Phase 1：透明桌面宠物窗口

## T101 创建透明窗口

实现：

- 无边框
- 透明
- alwaysOnTop
- skipTaskbar
- 不可调整大小

验收：

- 桌面上出现透明窗口
- 没有黑色背景
- 没有标题栏

---

## T102 窗口定位

实现：

- 指定坐标
- 屏幕工作区
- Dino 尺寸

验收：

- 不被屏幕裁剪
- Windows 任务栏不会导致明显错位

---

## T103 点击穿透

实现：

- passive click-through
- interactive mode

验收：

- 恐龙存在时可以正常点击桌面
- 可以点击浏览器
- 可以点击 IDE
- 进入交互状态后能够接收鼠标

---

# Phase 2：Dino Renderer

## T201 建立 Sprite Renderer

实现：

- 加载 PNG
- 动画帧
- FPS
- loop
- direction flip

验收：

- 能播放 idle
- 能播放 walk
- 左右方向正确

---

## T202 建立 Character Asset 结构

创建：

```text
assets/dino/
```

至少：

```text
character-sheet.png
idle
walk
turn
fire
water
tail
jump
sleep
reaction
```

注意：

如果正式 IP 素材尚未准备好，允许先使用开发占位素材，但必须在代码中明确标识 `placeholder`。

禁止 AI 自己临时生成大量不统一素材冒充正式 IP。

---

# Phase 3：四边移动

## T301 EdgePath

实现：

- TOP
- RIGHT
- BOTTOM
- LEFT

验收：

- 恐龙可以沿四边移动
- 不越界

---

## T302 Clockwise

实现：

```text
TOP → RIGHT → BOTTOM → LEFT
```

验收：

- 连续运行 5 分钟
- 无瞬移
- 无方向错误

---

## T303 Counterclockwise

实现：

```text
TOP → LEFT → BOTTOM → RIGHT
```

验收同上。

---

## T304 Random

实现：

- 随机方向
- 随机速度变化

验收：

- 不出现坐标异常
- 不卡角落

---

# Phase 4：动画状态机

## T401 State Machine

实现：

```text
IDLE
WALK
RUN
TURN
FIRE
WATER
TAIL
JUMP
SLEEP
REACTION
```

验收：

- 状态转换有明确入口和出口
- 无非法状态

---

## T402 Turn Animation

要求：

- 到边角前进入 TURN
- 播放 turn
- 改变方向
- 继续 WALK

验收：

视觉上不能像“瞬移转向”。

---

## T403 Random Behavior

实现 BehaviorSelector。

验收：

- 动作随机
- 有 cooldown
- 不连续刷同一动作
- 动作完成后恢复移动

---

# Phase 5：技能动画

## T501 Fire

流程：

```text
WALK
↓
FIRE
↓
fire effect
↓
WALK
```

验收：

- 动画完整
- 火焰不残留

---

## T502 Water

同上。

---

## T503 Tail

实现摇尾巴。

---

## T504 Jump

实现跳跃。

---

## T505 Sleep

实现：

```text
sleep
zzz
```

---

## T506 Reaction

实现：

- click reaction
- surprise
- angry

---

# Phase 6：鼠标交互

## T601 Drag

实现：

- mouse down
- offset
- drag
- mouse up

验收：

- 恐龙跟随鼠标
- 松手位置准确
- 不跳变

---

## T602 Click-to-Move

实现：

- 点击位置
- 目标点
- MOVE_TO_TARGET
- 到达
- IDLE

验收：

- 恐龙可以走向指定位置
- 到达后停留
- 自动恢复

---

## T603 Dino Click

实现：

- 单击
- 双击
- 连续点击

---

# Phase 7：托盘

## T701 Tray

菜单：

- Pause
- Resume
- Direction
- Speed
- Behavior
- Settings
- Exit

验收：

- Tray 始终存在
- 菜单操作实时生效

---

## T702 Pause

验收：

- 移动停止
- 状态保持
- Resume 恢复

---

# Phase 8：配置

## T801 Config Manager

保存：

- speed
- direction
- behavior
- clickThrough
- nightMode
- autoStart
- monitor

---

## T802 Settings

实现轻量设置页面。

禁止做复杂 SPA。

---

# Phase 9：系统能力

## T901 开机启动

用户可配置。

---

## T902 多显示器

至少：

- 获取显示器
- 选择显示器
- 显示器断开迁移

---

## T903 DPI

测试：

- 100%
- 125%
- 150%
- 175%

---

# Phase 10：性能优化

## T1001 CPU

检查：

- animation loop
- timer
- renderer
- effect

禁止：

- 高频无意义 setInterval
- 每帧日志
- 无限粒子
- 高频 IPC

---

## T1002 内存

运行 1 小时：

检查：

- 内存是否持续增长
- Sprite 是否重复加载
- effect 是否释放

---

## T1003 GPU

确认不持续进行高负载渲染。

---

# Phase 11：异常处理

测试：

- 显示器拔出
- 分辨率变化
- 窗口切换
- 全屏应用
- Explorer 重启
- 程序重复启动

---

# Phase 12：测试

## Unit

必须覆盖：

- EdgePath
- Direction
- Movement
- BehaviorSelector
- Cooldown
- StateMachine
- Config

---

## Integration

覆盖：

- Electron
- IPC
- Tray
- Config

---

## Manual

完整执行：

```text
启动
↓
行走
↓
转角
↓
吐火
↓
吐水
↓
摇尾巴
↓
发呆
↓
睡觉
↓
拖动
↓
点击移动
↓
点击穿透
↓
暂停
↓
恢复
↓
退出
```

---

# Phase 13：发布

## T1301 README

必须写清：

```bash
git clone ...
cd ...
npm ci
npm start
```

---

## T1302 Build

生成 Windows 构建产物。

---

## T1303 GitHub

准备：

- README
- LICENSE
- screenshots
- demo GIF
- release notes

---

# Phase 14：最终验收

只有全部通过才能标记：

```text
V1.0.0 READY
```

最终检查：

- [ ] 功能完整
- [ ] 无明显动画问题
- [ ] 无明显穿透问题
- [ ] 无明显 DPI 问题
- [ ] 无明显内存泄漏
- [ ] 无残留进程
- [ ] npm 安装正常
- [ ] npm start 正常
- [ ] npm build 正常
- [ ] README 完整
- [ ] GitHub 可发布

---

# V1.1 Backlog

不要在 V1 插入：

- 多恐龙
- 性格系统
- Character Pack
- Mod
- 社区
- 云同步

这些作为下一阶段任务。

---

# V2 Backlog

```text
多恐龙
恐龙性格
角色选择
角色包
自定义颜色
更多彩蛋
All Monitors
```

---

# V3 Backlog

```text
Character Pack SDK
Mod
社区角色
插件系统
```
