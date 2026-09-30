# DinoPet 项目地图（project_map.md）

> 用途：记录项目**全部文件路径与相互关系**，作为后续开发与内容查找的索引。
> 维护规则：新增/删除/移动文件或改变模块关系时同步更新本文件。
> 进度与决策依据见 `project_process.md`；需求/设计/任务/规范见根目录四份文档。
> 最后更新：2026-09-30（需求扩展 E3：托盘 + 设置窗口中英双语 i18n，默认纯英文、可切中文；新增 shared/i18n.ts + renderer/i18n.ts 手工同步副本 + 一致性单测。早期 E1/E2：拖完喷火×3 / 全局左键指路→到达吐水×3）

---

## 1. 总览

```
DinoPet/
├── 文档            PRD / TECH_DESIGN / TASK_LIST / SKILL / project_process / README / CHANGELOG + 本地图
├── src/               源码三进程：main / preload / renderer / shared
├── assets/            运行时资产（dino 10 组动画 + character-sheet）
├── effects/           特效素材（已接入 Phase 5：fire/water/dust/sparkle 弹体叠加层；zzz 无素材→程序文字）
├── previews/          素材方提供的 contact sheet 预览图（仅参考）
├── scripts/           开发期 Node 工具（切片/校验，不参与打包）
├── electron-builder.yml  打包配置(T1302：asar:false / portable+nsis / files=dist+src/renderer+assets+effects+package.json+uiohook-napi(win32)+node-gyp-build / npmRebuild:false / icon=build/icon.png(idle/01) / output=release)
├── tests/unit/        node --test 单元测试（.js，require dist/dist-unittest 产物）
├── tests/integration/ 集成测试（Config 持久化走真 fs；node --test 同 glob）
├── tests/manual-checklist.md  Phase 12 人工验收清单（Electron/IPC/Tray + 全流程）
├── DinoPet_AI_Asset_Pack_V1/  初版素材包（母版参考 + 3 份规范 md，历史依据）
├── dist/              tsc 构建产物（gitignore）
├── release/           electron-builder 打包产物（gitignore：portable exe / nsis setup / win-unpacked）
└── dist-unittest/     纯逻辑模块 CJS 编译产物（gitignore）
```

技术栈：Electron ^37 + TypeScript ^5.9 + Canvas/Sprite。运行时依赖仅 `uiohook-napi`（需求扩展④全局鼠标钩子；prebuildify N-API 预编译）；devDeps：electron / typescript / @types/node / pngjs / electron-builder。

---

## 2. 根目录文件

| 文件 | 角色 |
|---|---|
| `PRD.md` | 产品需求（功能/验收标准） |
| `TECH_DESIGN.md` | 技术设计（§2 模块、§4.1 小窗策略、§6 坐标、§14 动画、§20 IPC 安全） |
| `TASK_LIST.md` | 阶段任务清单（开发主线，Phase 0-14） |
| `DESKTOP_PET_DEVELOPMENT_SKILL.md` | 开发红线 Skill（§23 禁高频 IPC、§24 计时、§25 DPI、§27 不吞错、§30 调试浮层、§34 汇报格式） |
| `project_process.md` | **进度唯一依据**：§0 一览表 / §1 全局约定 / §2 阶段记录（倒序） |
| `project_map.md` | 本文件 |
| `CLAUDE_CODE_CODEX_QODER_MASTER_PROMPT.md` | 素材补齐方使用的总执行提示词（记录了 Final Asset Pack 的接入要求，如朝右主方向、fire/water 口腔起点等） |
| `README_ASSETS.md` | **素材权威说明**：256×256 RGBA 透明、朝右主方向、effects 仅装饰、fire/water 为一体化口腔喷射 |
| `asset-manifest.json` | **素材权威清单**：每动画 frames/fps/loop + canvas(256/baselineY=214) + directionStrategy(authored=right)。与 TS 清单一致性由单测校验 |
| `package.json` | 入口 `dist/main/main.js`；脚本 build/build:win/dev/start/test/lint（见 §7）；运行时依赖 uiohook-napi（④），devDep 含 electron-builder/pngjs |
| `electron-builder.yml` | T1302 打包配置：`asar:false`（保留相对目录布局与 nativeImage 可用）/ win portable+nsis / files 白名单含 uiohook-napi(仅 win32 prebuild)+node-gyp-build / `npmRebuild:false`（N-API 预编译免 VS）/ `icon:build/icon.png`（idle/01）/ output=release |
| `tsconfig.json` | main/preload/shared → CommonJS → `dist/` |
| `tsconfig.renderer.json` | renderer → ES2022 ESM → `dist/renderer/`（moduleResolution:Bundler，import 带 .js 后缀） |
| `tsconfig.unittest.json` | 纯逻辑 renderer 模块 `i18n.ts`（E3，供一致性单测）+ `animation/**` + `state/**`（含 ActionQueue）+ `effect/{EffectManifest,EffectEngine}.ts`（零 DOM）→ CommonJS → `dist-unittest/` 供单测 require |
| `.gitignore` / `LICENSE`(MIT) / `README.md` | 仓库基建 |
| `package-lock.json` | 锁文件 |

---

## 3. 源码与依赖关系

### 3.1 主进程（src/main/ → dist/main/）

```
main.ts  (入口，生命周期 + IPC + dev 判定 process.argv.includes('--dev'))；需求扩展④ startWalkToHook/stopWalkToHook(uiohook-napi 全局左键被动钩子)→onGlobalMouseDown(取 cursorScreenPoint DIP→moveToTarget 直线指路→showSunMarker)；clickThroughMode==='interactive' 守卫防误吞“点恐龙”
 ├── movement-engine.ts  createMovementEngine(win, opts) 移动引擎：16ms ticker + 真实 dt，
 │    │                   setPosition 移动窗口（整数坐标变化才调），状态变化才发 IPC
 │    │                   Phase 6 三活动模式 activity：patrol/target/drag（beginDrag/endDrag/moveToTarget/runAway）
 │    │                   drag 时主进程用 screen.getCursorScreenPoint() 轮询光标跟随窗口
 │    │                   Phase 7 setPaused(仅冻结 patrol)/setSpeed(walkSpeed 变量)；Phase 8 setWorkArea(切显示器)
 │    │                   需求扩展④：moveToTarget(x,y) 设 absTarget（clamp 进 rect 合法范围）；tick target 块按 dx/dy 直线步进，到达→dino:arrived→短暂 IDLE→nearestEdgePoint 贴回最近边恢复 patrol；moveFacing 定左右朝向
 │    ├── shared/movement.ts (路径纯函数：pathRect/stepMove/facingOn/nearestEdgePoint 等)
 │    └── shared/constants.ts (WALK_BASE_SPEED/TURN_DURATION_S/MOVE_TICK_MS/IDLE_AFTER_TARGET_MS/WALK_SPEED_*)
 ├── config-manager.ts   createConfigManager(filePath?) 配置持久化(T801)：默认 userData/config.json（filePath 可注入供集成测），get/set(clamp归一+落盘)/subscribe
 │    └── shared/config-schema.ts (纯：DinoConfig/DEFAULT_CONFIG/clampConfig/speedModeToPx/isNightHour；含 language 字段默认 en)
 ├── tray-manager.ts     createTray({engine,config,update,onSettings,onExit}) 常驻托盘(T701)：Pause 直控引擎，
 │                       Direction/Speed/Behavior/Language 经 update→config.set(单一真相)，Settings→开设置窗，refresh() 回显；
 │                       菜单文案经 shared/i18n 按 config.language 渲染（需求扩展 E3：默认纯英文可切中文；Language 子菜单选项恒显母语名 English/简体中文）；图标复用 idle/01 缩 16px
 ├── window-manager.ts   createPetWindow(bounds) 透明窗；createSettingsWindow() 轻量设置窗(T802)；createSunMarkerWindow(x,y,size) 需求扩展④落点“小太阳”瞬时窗(无边框/透明/alwaysOnTop screen-saver/setIgnoreMouseEvents 全透/无 preload，每点击新建→SUN_MARKER_MS 后 close 销毁)；applyClickThrough(win,mode) 穿透双模式(T103)
 ├── screen-manager.ts   getPrimaryWorkArea/getInitialPosition/clampIntoWorkArea + listDisplays/getDisplayWorkArea(P8) + watchDisplayChanges/displayExistsById/workAreaOfDisplay/displayIdAtBounds/primaryScaleFactor(P9 T902/T903) + cursorScreenPoint(需求扩展④ 全局钩子取主进程权威光标 DIP 落点)
 │    └── shared/geometry.ts (纯函数 clampToWorkArea/pointInRect，零 Electron 依赖)
 └── shared/constants.ts (APP_NAME / 尺寸 / IPC 通道名)
```

- IPC 注册在 `main.ts#registerIpc()`：`dino:ping`(handle)、`dino:set-interactive`(on，payload 校验+幂等，Phase 8 受 clickThrough 门控)、`dino:get-window-info`(handle)、`dino:set-movement`(on，Phase 3/6 白名单路由到引擎)、`dino:behavior`（main→renderer push 行为开关）。Phase 8 新增：`dino:get-config`/`dino:set-config`(handle，set 经 clampConfig 归一+落盘)、`dino:config-changed`(main→settings 窗广播)、`dino:get-displays`(handle 显示器列表)。需求扩展：`dino:arrived`(main→宠物 renderer push 到达一次性事件)。指路入口不在 IPC，而是 main.ts 的 uiohook-napi 全局左键钩子（每次点击 moveToTarget 覆盖旧目标 + showSunMarker 新建小太阳窗）。
- 配置驱动（Phase 8）：`config.subscribe(onConfigChanged)` → `applyConfig`（方向/速度/显示器→engine，行为→IPC，穿透→门控，自启→setLoginItemSettings，夜间→限慢速）+ `tray.refresh()` + 广播设置窗；启动 `whenReady` 内 `applyConfig(config.get())` 恢复持久化。
- 显示器监听（Phase 9 T902）：`whenReady` 注册 `watchDisplayChanges(handleDisplaysChanged)`、`onExit` 退订；变化时目标屏优先级 配置屏>当前屏>主屏，经 `movement.setWorkArea` 幂等重定位（拔出自动迁移）；维护 `currentDisplayId`；dev 日志输出 `primaryScaleFactor`（T903 DPI）。
- dev 模式：窗口加宽为 `DEV_WINDOW_WIDTH×DEV_WINDOW_HEIGHT`(372×128) 容纳调试面板；`console-message` 转发 renderer 日志到终端。Phase 10：dev-only 30s 低频 `[PERF]` 内存采样（`process.memoryUsage`+`app.getAppMetrics`）+ 启动一次 `getGPUFeatureStatus`（生产不启用，`perfTimer` 退出清理）。
- `window-all-closed`：Phase 7 改为「非退出态不 quit」（托盘常驻，仅 Exit 菜单 isQuitting→app.quit）。
- 异常加固（Phase 11）：顶层 `app.requestSingleInstanceLock()`（非主实例 quit）+ `app.on('second-instance')` 唤起已有窗口；`process.on('uncaughtException'/'unhandledRejection')` 清晰日志；createWindow 内 `render-process-gone`/`unresponsive`→reload（`did-fail-load` 仅日志防重载循环）。

### 3.2 Preload（src/preload/preload.ts → dist/preload/）

`contextBridge.exposeInMainWorld('dinoAPI', { ping, setInteractive, getWindowInfo, onMovementState, setMovement, onBehavior, getConfig, setConfig, onConfig, getDisplays, onArrived })`；
`onMovementState(cb)`/`onBehavior(cb)`/`onConfig(cb)`/`onArrived(cb)` 返回退订函数（`onArrived` 供需求扩展④到达吐水）；通道名字符串与 `shared/constants.ts` **手工同步**（sandbox 下不 require 本地模块，有注释标注）。

### 3.3 共享（src/shared/ → dist/shared/）

| 文件 | 导出 | 被谁用 |
|---|---|---|
| `constants.ts` | APP_NAME, DINO_RENDER_SIZE=96, EFFECT_MARGIN=16, PET_WINDOW_WIDTH/HEIGHT=128, DEV_WINDOW_WIDTH=372/HEIGHT, IPC_CHANNEL_*(含 BEHAVIOR + 需求扩展 ARRIVED), ACTION_GAP_MS=180, SUN_MARKER_SIZE/SUN_MARKER_MS, WALK_BASE_SPEED/TURN_DURATION_S/MOVE_TICK_MS/IDLE_AFTER_TARGET_MS/WALK_SPEED_SLOW·NORMAL·FAST | main.ts, movement-engine, window-manager, screen-manager, tray-manager, preload(注释同步)；ACTION_GAP_MS 由 app.ts 内联镜像 |
| `geometry.ts` | clampToWorkArea, pointInRect, WorkArea/WindowPos 类型 | screen-manager, tests/unit/geometry.test.js |
| `movement.ts` | 四边路径纯函数：pathRect/nextEdge/edgeEnd/facingOn/nearestEdgePoint(Phase 6 拖动落位与点击目标共用)/createMoveState/stepMove + Edge/MoveMode/MoveState 等类型 | movement-engine, tests/unit/movement.test.js |
| `config-schema.ts` | Phase 8 配置纯模：DinoConfig/SpeedMode/DirectionMode + DEFAULT_CONFIG + clampConfig(非法回落) + speedModeToPx + isNightHour；**含 language 字段**（需求扩展 E3，默认 en，非法回落） | config-manager, main.ts, tray-manager, settings.ts(结构同形), tests/unit/config-schema.test.js |
| `i18n.ts` | **需求扩展 E3 词条字典**（纯数据）：Language('en'\|'zh')、LANGUAGES、DEFAULT_LANGUAGE='en'、STRINGS{en,zh}(~33 键)、t(lang,key)（缺失逐级回落不崩）。`src/renderer/i18n.ts` 为手工同步副本 | tray-manager（主进程直接 import）；renderer/i18n.ts 供 settings.ts；一致性由 tests/unit/i18n.test.js 校验 |

### 3.4 Renderer（src/renderer/ → dist/renderer/，ESM，页面经 `<script type="module">` 加载）

```
settings.html ── settings.ts   轻量设置页(T802，无框架/无 SPA)：控件变更→dinoAPI.setConfig 即时落盘生效；订阅 onConfig 与托盘同步；显示器下拉 getDisplays；
 │                       需求扩展 E3：文案由 i18n.ts（手工同步 shared/i18n）按 config.language 刷新所有 [data-i18n] 元素 + document.title + <html lang> + 显示器下拉本地化；新增 Language 选择控件（与托盘同一配置双向同步）
i18n.ts           需求扩展 E3：src/shared/i18n.ts 的手工同步副本（renderer ESM 隔离无法 import shared；STRINGS/t/Language，一致性单测守护）
sun-marker.html  需求扩展④：落点“小太阳”标记页（内联 CSS 加载即自播淡入淡出；由 main createSunMarkerWindow 每点击新建、SUN_MARKER_MS 后 close 销毁；无 preload/无 IPC，全透点击回桌面）
index.html ── styles.css
 └── app.ts  装配层（窗口常量手工同步 shared/constants；命中检测+模式控制；订阅 movement 相位/朝向/activity；Phase 4 动画由状态机单一驱动；Phase 6 鼠标拖动/点击移动/单击双击连点；Phase 8 全局 dinoAPI 类型唯一定义处；需求扩展 ActionQueue 编排(拖完喷火×3 / onArrived 吐水×3，相邻 ACTION_GAP_MS，queueActive 压制 MOVE_TO_TARGET 抢占；interruptQueue 在指路重新起步时清空队列防滑屏）；Phase 10 按需重绘门控（主体帧/朝向/活动特效未变则跳过整面 clear+draw，降 transparent+alwaysOnTop 窗重合成）；dev 调试面板+HUD）
      ├── animation/AnimationDefinition.ts  AnimationId/AnimationDefinition/validateManifest（纯）
      ├── animation/AnimationManifest.ts    ANIMATIONS 10 组配置 + DINO_SOURCE_FACING='right'（纯）
      ├── animation/AnimationEngine.ts      帧推进/loop/one-shot/onFinished（纯，零 DOM）★单测直连
      ├── state/StateMachine.ts             DinoStateMachine 行为状态机（T401 12 态转换含 DRAGGED/MOVE_TO_TARGET/T402 turn/T403 BehaviorSelector+冷却；§11 优先级 tick 顶部短路；Phase 7 input.behaviorEnabled 门控随机）（纯）★单测直连
      ├── state/ActionQueue.ts              需求扩展：一次性动作队列（纯逻辑，零 DOM）★单测直连（start 清空旧队列+返回首个 / next 顺序 drain / pending / clear）
      ├── effect/EffectManifest.ts          5 特效定义(fire/water/dust/sparkle/zzz)+validateEffects（纯）★单测直连
      ├── effect/EffectEngine.ts            特效生命周期 spawn/update/renderables/destroy（纯）★单测直连
      ├── effect/EffectPlayer.ts            预加载 effects/ 精灵 + 委托 EffectEngine + 解析当前帧（DOM）
      ├── asset/SpriteSheet.ts              帧 Image 预加载缓存；base 可切 dino/effects；URL=<base><dir>/NN.png
      ├── render/DinoRenderer.ts            DPR 适配 + drawFrame(flipped 镜像) + drawEffect/drawEffectText(叠加不清屏) + drawPlaceholder 兜底
      └── core/GameLoop.ts                  rAF + dt 钳制 0.1s
```

- 方向模型：素材全部**朝右**；`app.ts#isFlipped()` = 显示方向 ≠ 'right' 时 `DinoRenderer` 做 `scaleX(-1)` 镜像，不复制素材。
- **Phase 4 驱动链**：GameLoop 每帧 `stateMachine.tick(dt, currentInput())` → `applyStateOutput`（动画变化才 setAnimation=enter 语义 + HUD + 面板高亮 + 移动门控）；`AnimationEngine.onFinished` → `stateMachine.finishAction()`（one-shot 结束回基态）；movement 相位仅供 `movePhase` 闭包（含 turn 检测）与朝向输入。特殊动作/SLEEP 期间 `moveEnabled=false` 暂停窗口位移。
- **Phase 6 交互链**（app.ts）：`currentInput()` 从 `movementState.activity` 派生 `{dragging,movingToTarget,userInteracting}` 喂状态机（§11 最高优先级短路）；mousedown 本体→mousemove 超阈 `dragStart{offset}`→mouseup `dragEnd`（主进程轮询光标接管）；点击 `registerClick`：单击→REACTION、双击→runAway、连点≥3→低概率 FIRE。
- 命中检测（T103）：恐龙区 96px（进入）/112px（退出滞回）OR 调试面板区 → 仅状态变化发 `setInteractive` IPC。
- placeholder 渲染路径保留为**兜底**（素材加载失败时显式提示），当前 10 组均为正式素材不再触发。

### 3.5 跨进程消息流

```
main movement-engine 相位/边/朝向变化 --dino:movement-state(push)--> app.ts#applyMovementState
                                    （驱动 walk/turn/idle 动画 + facing + HUD Move 行）
renderer 面板 Move/Mode 按钮 --dinoAPI.setMovement--> main 白名单校验 --> engine.setEnabled/setMode
                                       （手动点播动画置 manualOverride，直到下个 phase 变化交还驱动权）
renderer mousemove 命中变化 --dinoAPI.setInteractive(bool)--> main 幂等 --> setIgnoreMouseEvents
renderer Phase 6 拖动 mousedown+位移 --setMovement{dragStart{offset}}--> engine.beginDrag → tick 内 screen 光标-偏移 setPosition → mouseup --{dragEnd}--> engine.endDrag 保位恢复 patrol
renderer Phase 6 双击 --setMovement{runAway}--> engine.runAway(随机远点) / 点击交互区 --{moveTo{x,y}}--> engine.moveToTarget → activity=target → 到达 IDLE 停顿 → 恢复 patrol
需求扩展 喷火：拖动 mouseup --{dragEnd}--> engine.endDrag 后 app.ts endDragIfNeeded → enqueueActions([FIRE×3])（ActionQueue 相邻间隔重播，播完 finishAction 回基态）
需求扩展 指路吐水：tray "Walk to…" --onPointMode--> main.enterPointMode → createPointOverlayWindow 全屏 overlay → 左键 --dinoAPI.pointClick--> ipcMain(POINT_CLICK) 主进程 cursorScreenPoint→engine.moveToTarget→leavePointMode；到达 --dino:arrived--> app.ts onArrived → enqueueActions([WATER×3])
renderer 启动 --dinoAPI.ping--> {pong,version,isDev}（控制调试面板/浮层显隐）
renderer 启动（先订阅 movement-state 后）--dinoAPI.getWindowInfo--> {bounds,workArea,clickThroughMode,movement}（HUD+补拉初始态）
tray-manager Phase 7/8：Pause --engine.setPaused；Direction/Speed/Behavior --update--> config.set --> (订阅)applyConfig --> engine.setMode/setSpeed + IPC dino:behavior --> app.ts behaviorEnabled --> StateMachine；Settings… --onSettings--> openSettings；Exit --> onExit(isQuitting→destroy→app.quit)
Phase 8 配置流：settings.ts --dinoAPI.setConfig--> main config.set(clamp+写盘) --> onConfigChanged{applyConfig + tray.refresh + 向 settings 窗 dino:config-changed}；启动 whenReady applyConfig(config.get()) 恢复；60s checkNight 夜间态翻转才重应用
```

---

## 4. 资产（运行时读取）

| 路径 | 内容 | 消费方 |
|---|---|---|
| `assets/dino/idle/01-06.png` | 待机 6f@8fps loop | SpriteSheet（经 ANIMATIONS.idle） |
| `assets/dino/walk/01-08.png` | 行走 8f@10fps loop | 同上 |
| `assets/dino/run/01-08.png` | 奔跑 8f@14fps loop | 同上 |
| `assets/dino/turn/01-05.png` | 转身 5f@10fps one-shot | 同上（Phase 3/4 转向用） |
| `assets/dino/fire/01-10.png` | 吐火 10f@12fps（口腔喷射，Phase 5） | 同上 |
| `assets/dino/water/01-10.png` | 吐水 10f@12fps（同上） | 同上 |
| `assets/dino/tail/01-08.png` | 摇尾 8f@10fps | 同上 |
| `assets/dino/jump/01-08.png` | 跳跃 8f@12fps | 同上 |
| `assets/dino/sleep/01-06.png` | 睡觉 6f@5fps loop | 同上（Phase 4 闲置） |
| `assets/dino/reaction/01-08.png` | 受击/反应 8f@12fps | 同上（Phase 6 交互） |
| `assets/dino/character-sheet.png` | 角色母版参考（方案2） | 不参与运行，设计对照 |
| `effects/{fire,water,dust,sparkle}/01-06.png`（**工程根目录**，非 assets/ 下） | 装饰弹体/粒子（README 明示**不得**替代 fire/water 一体化帧） | **已接入**：EffectPlayer 经 EFFECT_ASSET_BASE 加载，DinoRenderer.drawEffect 叠加（Phase 5） |
| `previews/*_contact_sheet.png` | 素材方预览图 | 不参与运行，目检对照 |

- 全部角色帧规格：256×256 RGBA 透明底、朝右、基线 baselineY=214（`asset-manifest.json`）。渲染尺寸 96（窗口 128）。
- 素材来源沿革：初版 `DinoPet_AI_Asset_Pack_V1/`（朝左整表，经 `scripts/extract-frames.js` 切片出旧 idle/walk/run）→ 2026-09-29 用户补齐 **Final Asset Pack**（朝右单帧 PNG 直接落盘，覆盖旧切片产物，10 组全齐）。旧切片脚本保留为开发工具，不再是素材来源。

---

## 5. 开发期脚本（scripts/，CommonJS，不进打包）

| 脚本 | 用法 | 说明 |
|---|---|---|
| `scripts/validate-assets.js` | `node scripts/validate-assets.js` | 按 asset-manifest.json 校验磁盘帧：数量/256×256/非空/四角透明 |
| `scripts/extract-frames.js` | `node scripts/extract-frames.js <sheet.png> <outDir> <a,b,c>` | 整表图切单帧（连通域+洪泛扣底+基线对齐）；历史工具，处理无单帧交付的素材表时用 |
| `scripts/capture-screen.ps1` | `powershell -File scripts/capture-screen.ps1 [-OutFile p] [-X -Y -Width -Height]` | **T1303 截图取证**（PowerShell）：DPI 感知全屏/区域 CopyFromScreen，输出物理分辨率 PNG |
| `scripts/crop-png.js` | `node scripts/crop-png.js <in.png> <x> <y> <w> <h> <out.png>` | 按坐标从全屏截图裁特写（pngjs）；README 实拍取图用 |

> 截图产物：`screenshots/dino-on-desktop.png` 等精选特写入库；全屏中间帧（`screenshots/raw/`、`_probe.png`）含桌面隐私，已 `.gitignore` 排除。自动定位恐龙/特效帧的尝试（颜色/密度阈值）在开着 IDE（其预览窗里就有一只大绿恐龙）+宠物持续移动+PowerShell DPI 空间不一致的环境下不可靠，已删除；动作帧（喷火/吐水）改由用户现场拖拽/指路时手动 `capture-screen.ps1` 截取。

---

## 6. 测试（`node --test` glob `"tests/**/*.test.js"`，含 unit + integration）

| 文件 | 覆盖 | 依赖产物 |
|---|---|---|
| `smoke.test.js` | 常量导出/窗口尺寸推导/IPC 通道名 | `dist/shared/constants.js` |
| `geometry.test.js` | clampToWorkArea 边界 7 条 | `dist/shared/geometry.js` |
| `animation-engine.test.js` | loop 取模/one-shot 钳制+回调一次/setAnimation 幂等/dt≤0 | `dist-unittest/animation/AnimationEngine.js` |
| `asset-manifest.test.js` | validateManifest/10 组齐全/朝右声明/全正式素材/磁盘帧数连续/**与 asset-manifest.json 一致** | `dist-unittest/animation/*` + 根 `asset-manifest.json` |
| `movement.test.js` | 四边路径 15 条：pathRect/nextEdge/edgeEnd/facingOn/cw·ccw 闭环/转角禁瞬移/5 分钟无跳变×3 模式/random 换向(T304)/退化路径/速度系数 + Phase 6 nearestEdgePoint 投影 4 条 | `dist/shared/movement.js` |
| `state-machine.test.js` | 行为状态机 18 条：T401 基态跟随/触发特殊+finishAction/无非法状态/SLEEP；T402 WALK→TURN→WALK；T403 概率/权重/冷却/maxRepeat/交替/交互禁随机 + Phase 6 DRAGGED/MOVE_TO_TARGET 优先级 6 条 + Phase 7 behaviorEnabled 禁用 1 条 | `dist-unittest/state/StateMachine.js` |
| `action-queue.test.js` | 需求扩展 动作队列纯逻辑 5 条：start 返回首个+next 顺序 drain+pending 计数、新 start 清空旧队列(打断)、start 空数组→null、clear 放弃、只读源数组 slice 拷贝不被破坏 | `dist-unittest/state/ActionQueue.js` |
| `config-schema.test.js` | Phase 8 配置纯函数 8 条：clampConfig 空/非对象回落默认、合法保留、非法枚举/类型回落、monitorId 空串归 null、字段齐全、**language 默认/合法/非法回落（E3）**；speedModeToPx 三档映射；isNightHour 23~07 | `dist/shared/config-schema.js` + `dist/shared/constants.js` + `dist/shared/i18n.js` |
| `i18n.test.js` | 需求扩展 E3 词条 6 条：**shared↔renderer 两份 STRINGS 完全一致**、DEFAULT_LANGUAGE/LANGUAGES 一致且默认 en、en/zh 键集一致覆盖期望键、词条非空、语言名恒显母语、t() 逐级回落 | `dist/shared/i18n.js` + `dist-unittest/i18n.js` |
| `effect.test.js` | 特效层 9 条：validateEffects/**磁盘帧数与清单一致**/嘴部弹体声明；一次性自动销毁(不残留)/帧推进/progress与淡出/loop幂等与cancel/多特效并存/dt≤0 | `dist-unittest/effect/{EffectEngine,EffectManifest}.js` + 根 `effects/` |
| `../integration/config-persistence.test.js` | Phase 12 Config 集成 5 条：set 落盘→新实例读回、坏 JSON 回落默认、非法值 clamp 后落盘、subscribe 通知/退订、目录递归创建 | `dist/main/config-manager.js`（临时目录注入 filePath） |

---

## 7. 构建与运行链

```
npm run build = tsc -p tsconfig.json（main/preload/shared→dist/）
              + tsc -p tsconfig.renderer.json（renderer→dist/renderer/）
npm run dev   = build + electron . --dev（宽窗+调试面板+DevTools+console 转发）
npm start     = build + electron .（正式 128×128 小窗，无调试面板）
npm run build:win = build + electron-builder --win（产出 release/ portable exe + NSIS 安装器，T1302）
npm test      = build + tsc -p tsconfig.unittest.json + node --test "tests/**/*.test.js"（unit+integration）
npm run lint  = 双 tsconfig --noEmit 类型检查（无 ESLint）
```

页面加载路径：`src/renderer/index.html`（main.ts loadFile）→ `dist/renderer/app.js`（相对 ../../dist）；
资产经 `file://` 相对路径 `assets/dino/...` 加载，CSP 白名单 `img-src 'self' file:`。

---

## 8. 初版素材包（历史依据，只读）

```
DinoPet_AI_Asset_Pack_V1/
├── 01_CHARACTER_ASSET_SPEC.md      角色规范（配色 #6CCB7A/#FFE8A8/#2E7D32、256 画布、渲染 64~128）
├── 02_IMAGE_GENERATION_PROMPT.md   各动画帧生成提示词（fire/water 口腔起点、turn 减速转身等验收点）
├── 03_CLAUDE_CODE_ASSET_INTEGRATION_PROMPT.md  十阶段接入流程（调试面板按钮要求已在 Phase 2 落实）
├── DinoPet_方案2_角色设计母版参考.png  母版（已复制为 assets/dino/character-sheet.png）
└── Idle_Walk_Run.png               初版整表（朝左，已被 Final Asset Pack 单帧取代，留档）
```

---

## 9. 约定速查（详见 project_process.md §1）

1. Git 全程不 commit，项目完成后统一提交（用户指示）。
2. renderer 与 main 隔离：sandbox+ESM，窗口/尺寸常量在 `app.ts`/`DinoRenderer.ts`/`preload.ts` 顶部**手工同步**并注释指向 `shared/constants.ts`；需求扩展 E3 的 i18n 词条同走此约定（`src/renderer/i18n.ts` 镜像 `src/shared/i18n.ts`，由 `tests/unit/i18n.test.js` 强校验两份一致）。
3. IPC 只在状态变化时发送，禁高频（移动阶段设计时注意）。
4. 新增依赖必须说明必要性；禁止引入前端框架/游戏引擎/数据库。
5. Windows PowerShell：命令分隔用 `;`；Node 测试用 glob 路径。
