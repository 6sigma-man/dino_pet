# DinoPet — Claude Code / Codex / Qoder 一次性执行总提示词

你现在是 DinoPet Electron 桌面宠物项目的主开发代理。不要只给建议，要直接修改项目、运行、测试并修复，直到核心验收项通过。

## 0. 输入资产与优先级
项目根目录会放置一个素材压缩包：
`DinoPet_Final_Asset_Pack.zip`

必须先解压并读取：
- `README_ASSETS.md`
- `asset-manifest.json`
- `assets/dino/character-sheet.png`
- `assets/dino/{idle,walk,run,turn,fire,water,tail,jump,sleep,reaction}/*.png`
- `effects/{fire,water,dust,sparkle}/*.png`

同时优先读取项目已有文档（存在则必须读）：
- `PRD.md`
- `TECH_DESIGN.md`
- `TASK_LIST.md`
- `DESKTOP_PET_DEVELOPMENT_SKILL.md`
- `01_CHARACTER_ASSET_SPEC.md`

若文档与本提示词有冲突：
1. Fire / Water 的“嘴巴真实开合 + 喷射起点在口腔内部”优先级最高；
2. 保持 Electron + TypeScript + Canvas/Sprite + PNG 的简单方案；
3. 不要为了动画引入 React/Vue/Three.js/游戏引擎/后端/数据库/复杂 ECS。

## 1. 解压和接入目录
自动找到 zip 并解压。不要要求我手工操作。

优先接入为：
`<renderer可访问的静态资源目录>/assets/dino/...`
和
`<renderer可访问的静态资源目录>/effects/...`

如果项目已有 assets/public/resources 约定，遵守现有约定；不要凭空重构整个项目。
确保开发环境与打包后的 Electron 都能正确解析资源路径。

## 2. Sprite Animation
实现一个简单可靠的 `AnimationController`，至少支持：
- `setAnimation("idle" | "walk" | "run" | "turn" | "fire" | "water" | "tail" | "jump" | "sleep" | "reaction")`
- 当前动画、当前帧、FPS、loop
- one-shot 动画
- 动画结束回调
- 切换动画时按需从第 1 帧开始
- 右向原图
- 左向使用 Canvas 水平镜像，不复制一套素材
- 资源预加载 / 缓存
- 丢帧保护：基于 delta time 计算帧推进，避免 setInterval 漂移

从 `asset-manifest.json` 读取每个动画的帧数/FPS/loop；不要硬编码两套冲突配置。

## 3. 四边行走
桌宠必须能沿当前显示器工作区四边移动：
- top
- right
- bottom
- left

要求：
- 不允许只在底边左右走。
- 建立 edge 状态机，例如 `top/right/bottom/left`。
- 到角落后可转入相邻边。
- 顺时针模式：top→right→bottom→left→top。
- 逆时针模式：top→left→bottom→right→top。
- 正确处理每条边上的坐标增长方向。
- 根据水平移动方向决定 right/left sprite flip。
- 在垂直边移动时，角色仍用合适的视觉朝向；V1 不需要生成朝上/朝下的全新美术。
- 使用 Electron `screen.getDisplayMatching` / `workArea`（或项目已有等价方案）适配任务栏和多显示器。
- 角色不可跑出 workArea。

## 4. 顺/逆时针
实现：
- `clockwise`
- `counterClockwise`

要求：
- 可在运行时切换。
- 下一次到角落时按新方向选择边。
- 转角时播放 `turn`，不是瞬间 90° 生硬跳转。
- `turn` 播放结束后继续 `walk` 或 `run`。

## 5. 随机行为系统
不要随机乱播动画，要建立带权重/冷却/互斥的行为控制：
基础状态：
- idle
- walk
- run
- sleep

低概率 one-shot：
- tail
- fire
- water
- jump

交互触发：
- reaction

建议规则：
- walk 持续时间长于 idle。
- run 是短时加速，然后回 walk。
- tail/fire/water/jump 都有 cooldown，避免连续触发。
- fire/water 播放期间暂停普通移动或显著减速。
- 长时间无输入后进入 sleep。
- 鼠标/拖拽/点击后退出 sleep。
- one-shot 播完必须恢复 previous state。
- 不允许 fire/water 与 drag 同时执行。

## 6. Fire / Water：最高优先级验收
禁止做法：
- 不要把 `effects/fire` 或 `effects/water` 当成主实现，简单贴在嘴前。
- 不要用代码伪造“嘴巴开合”。

必须逐帧播放 `assets/dino/fire/01.png ... 10.png`
和 `assets/dino/water/01.png ... 10.png`。

自动或人工调试页面必须能逐帧确认：
Fire：
1 正常
2 准备
3 嘴巴开始张
4 明显张开
5 完全张开
6 火焰从口腔内部出现
7 增强
8 最大
9 缩小
10 嘴巴闭合

Water 同理。

验收必须检查：
- 嘴巴确实连续张开/闭合；
- 喷射源头位于口腔内部；
- 不是独立贴图贴在嘴外；
- 最后一帧恢复正常嘴型；
- 左向镜像后喷射方向也正确。

`effects/*` 只能作为额外粒子/尾迹/落地效果，不得替代角色帧本身。

## 7. 拖拽
实现桌宠拖拽：
- pointer/mouse down 命中可见角色区域后开始拖拽；
- 拖拽时临时暂停自动行为/移动；
- 移动 Electron 窗口位置；
- 松开后将角色吸附到离当前位置最近的 workArea 边；
- 根据落点更新 edge；
- 经过短暂 reaction/idle 后恢复自动行为；
- 防止把窗口拖到屏幕外；
- 多显示器时重新计算目标 display。

如果项目采用透明无边框窗口，确保拖拽逻辑与窗口点击穿透策略兼容。

## 8. 点击移动
实现点击屏幕目标点后移动：
- 当用户点击允许交互的区域/通过项目已有交互层给出目标点时，计算目标屏幕坐标；
- 将目标点投影到 workArea 最近边，或按项目已有交互定义处理；
- 生成沿四边的最短或合理路径；
- 角色用 walk/run 逐步移动，不允许瞬移；
- 经过角落时播放 turn；
- 到达目标后 idle；
- 新点击可取消旧路径并重新规划。

如果透明点击穿透导致无法直接捕获全屏点击，则优先采用项目已有全局交互方案；不要为了这个功能引入高风险原生钩子依赖。若项目没有全局点击来源，实现“宠物窗口可交互时的点击目标移动 + 清晰的接口函数 `moveToScreenPoint(x,y)`”，并在测试报告中说明平台限制。

## 9. 点击穿透
目标是桌宠平时不挡用户操作，同时角色可交互。

优先方案：
- Electron `BrowserWindow.setIgnoreMouseEvents(true, { forward: true })`
- 当鼠标位于角色实际可见/交互区域时临时关闭穿透；
- 鼠标离开后恢复穿透；
- 拖拽期间强制可交互；
- 菜单/调试 UI 打开时强制可交互。

不要让整个透明矩形窗口永久吃掉点击。

实现 hit test 时：
- 最低可用：基于角色绘制矩形/缩小后的命中框；
- 更好：基于当前 sprite alpha 做透明像素命中；
- 选择与你当前项目复杂度匹配的简单可靠方案。

## 10. 渲染
使用 Canvas 2D/Sprite：
- 保留透明背景。
- 关闭不必要的图像平滑（像素边缘若需要清晰）或根据当前素材效果选择。
- 渲染尺寸默认 96×96 左右，并通过配置允许 64–128。
- 所有动画共享相同 pivot/baseline。
- 左向通过 `ctx.scale(-1,1)` 或等价变换完成。
- 不改变源 PNG。

## 11. Debug / QA 页面
开发模式加入 Animation Debug：
按钮：
Idle / Walk / Run / Turn / Fire / Water / Tail / Jump / Sleep / Reaction

显示：
- Animation
- Frame: x/y
- FPS
- Edge
- Direction
- Orbit: clockwise/counterClockwise
- Position
- Current behavior
- IgnoreMouseEvents 状态

附加：
- “逐帧上一帧/下一帧”
- “播放 Fire”
- “播放 Water”
- “切换 CW/CCW”
- “随机行为开/关”
- “显示 hitbox”

## 12. 自动测试与运行验收
不要只写代码不运行。

按项目现有脚本执行，优先：
- install（仅在依赖缺失时）
- typecheck
- lint
- unit test
- build
- Electron dev/start

如果没有测试框架，不要为 V1 引入重型测试体系；至少写轻量单测/纯函数测试覆盖：
- edge 转换 clockwise
- edge 转换 counterClockwise
- corner 路径
- 最近边吸附
- animation frame progression
- one-shot 回调与 previous state
- cooldown/互斥
- moveToScreenPoint 路径生成

运行 Electron 后检查控制台：
- 0 个资源 404
- 0 个未处理 promise
- PNG 均正常透明加载
- fire/water 10 帧均能到达
- 透明窗口有效
- 点击穿透有效
- 拖拽后能吸附
- 四边移动不会越界
- CW/CCW 顺序正确

## 13. 必须自己修复
测试失败时：
- 读取错误
- 定位根因
- 修改
- 重新运行
直到核心测试通过或确认是当前环境无法验证的 GUI/OS 行为。

不要在首次报错后停止。
不要把“请用户自己测试”当作完成。

## 14. 最终输出
完成后给出：
1. 修改/新增文件列表
2. 架构简述
3. 资产实际接入目录
4. AnimationController 说明
5. 四边行走状态机说明
6. CW/CCW 实现
7. 随机行为权重/cooldown
8. 拖拽实现
9. 点击移动实现
10. 点击穿透实现
11. Fire 验收结果：逐项说明嘴巴开合、帧 6 起喷、喷射起点
12. Water 验收结果：逐项说明嘴巴开合、帧 6 起喷、喷射起点
13. 实际运行过的命令
14. typecheck/lint/test/build/Electron 启动结果
15. 仍无法自动验证的项目（如果有）

## 15. 完成判定
只有下面全部满足，才可声明完成：
- 动画能播放；
- 四边能走；
- CW/CCW 能切；
- 随机行为正常；
- 拖拽正常；
- 点击移动接口/行为正常；
- 点击穿透正常；
- Fire 嘴巴张合明显且火从口腔内部出来；
- Water 嘴巴张合明显且水从口腔内部出来；
- 运行测试通过或对 OS GUI 限制给出明确证据；
- 没有用“简单叠特效”冒充 Fire/Water。
