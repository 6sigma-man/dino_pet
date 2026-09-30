# DinoPet 开发进度追踪（project_process.md）

> 用途：记录每个阶段**实际完成的内容、关键实现细节、验证结果与遗留问题**，作为后续制作与修改的事实依据。
> 维护规则：每完成一个阶段（通过该阶段验收后），在「阶段记录」顶部倒序追加一条；改动已有功能时同步修订对应条目，不留过期描述。
> 依据文档：PRD.md / TECH_DESIGN.md / TASK_LIST.md / DESKTOP_PET_DEVELOPMENT_SKILL.md

---

# 0. 总体进度一览

| Phase | 内容 | 状态 | 完成日期 |
|---|---|---|---|
| Phase 0 | 项目初始化（Git/npm/Electron 骨架） | ✅ 完成 | 2026-09-29 |
| Phase 1 | 透明桌面宠物窗口（T101-T103） | ✅ 完成（待人工确认） | 2026-09-29 |
| Phase 2 | Dino Renderer（T201-T202） | ✅ 完成（待人工确认动画表现） | 2026-09-29 |
| Phase 3 | 四边移动（T301-T304） | ✅ 完成（待人工确认行走表现） | 2026-09-29 |
| Phase 4 | 动画状态机（T401-T403） | ✅ 完成（待人工确认行为表现） | 2026-09-29 |
| Phase 5 | 技能动画（T501-T506） | ✅ 完成（待人工确认特效表现） | 2026-09-29 |
| Phase 6 | 鼠标交互（T601-T603） | ✅ 完成（待人工确认拖动/点击手感） | 2026-09-29 |
| Phase 7 | 托盘（T701-T702） | ✅ 完成（待人工确认托盘菜单交互） | 2026-09-29 |
| Phase 8 | 配置（T801-T802） | ✅ 完成（待人工确认设置窗/持久化） | 2026-09-30 |
| Phase 9 | 系统能力（T901-T903） | ✅ 完成（待人工确认多屏拔出/自启） | 2026-09-30 |
| Phase 10 | 性能优化（T1001-T1003） | ✅ 完成（主循环改按需重绘降载；待真机 1h 内存 soak） | 2026-09-30 |
| Phase 11 | 异常处理 | ✅ 完成（待人工拔屏/Explorer重启核验） | 2026-09-30 |
| Phase 12 | 测试（Unit/Integration/Manual） | ✅ 完成（待人工执行 Manual 清单） | 2026-09-30 |
| Phase 13 | 发布（README/Build/GitHub） | ✅ 完成（自定义图标+免 VS 打包已验；截图工具+idle 实拍已交，动作帧待补；Git 并入 Phase 14） | 2026-09-30 |
| Phase 14 | 最终验收 V1.0.0 READY | 🟡 自动化验收全绿（lint/test/ci/build/start）；**已产出 1.2.0 打包产物**（Portable+Setup exe）；待人工目检 + Git 授权 | 2026-09-30 |
| 需求扩展 E1 | ③ 拖完喷火×3（相邻含 ~180ms 短间隔） | ✅ 完成并经用户目检确认 | 2026-09-30 |
| 需求扩展 E2 | ④ 指路走过去→到达吐水×3：**全局左键钩子 + 直线走向点击点 + 小太阳落点标记**（历经 托盘→overlay → 钩子Alt → 纯左键绕边 → 直线 五轮迭代） | ✅ 完成并经用户目检确认（lint/test 81·81/start 绿） | 2026-09-30 |
| 需求扩展 E3 | ⑤ **托盘 + 设置窗口中英双语 i18n**：所有托盘菜单项与设置窗文案按 `config.language` 渲染；**默认纯英文**，可切中文（Language 子菜单 / 设置窗语言下拉，同一配置双向同步）；语言名恒显母语 | ✅ 自动化验收全绿（lint/test 88·88 + HTML 键校验/start 绿）；待人工目检语言切换 | 2026-09-30 |

---

# 1. 全局约定（长期有效，后续阶段必须遵守）

1. **Git 提交时机**：用户 2026-09-29 指示——项目最终完成后统一提交，各开发阶段中途不 commit（仓库已 `git init -b main`，改动留在工作区）。
2. **环境**：Node v22.22.0 / npm 10.9.4 / git 2.54.0，Windows（PowerShell，不支持 `&&`，用 `;`）。
3. **依赖纪律**：**运行时依赖原为零**，需求扩展④引入**首个运行时依赖 `uiohook-napi ^1.5.5`**（全局鼠标钩子，用户 2026-09-30 批准；prebuildify 预编译 N-API .node，跨 Node/Electron ABI 稳定、**无需 node-gyp/VS 编译**；打包配 `npmRebuild:false` 免重编，详 Phase 13 补充）。devDependencies：electron ^37、typescript ^5.9、@types/node ^22、pngjs ^7（开发期切片/校验）、electron-builder ^26（Phase 13 T1302 打包，用户 2026-09-30 批准引入）。新增依赖必须说明必要性并经用户批准。Electron/electron-builder 二进制经 npmmirror 镜像下载（`ELECTRON_MIRROR` 等环境变量，未写入仓库）。
4. **素材约定**：运行时素材以 **DinoPet Final Asset Pack**（根目录 `README_ASSETS.md` + `asset-manifest.json`，2026-09-29 补齐 10 组）为权威源：256×256 RGBA 透明底、**主方向朝右**（朝左镜像）、帧数/FPS/loop 以 asset-manifest.json 为准（TS 清单一致性有单测强校验）。`effects/` 为可选装饰素材，**不得**用于替代 fire/water 一体化口腔喷射帧。`DinoPet_AI_Asset_Pack_V1/` 为初版参考（历史依据）。占位机制（placeholder 渲染+显式标识）保留为素材缺失时的兜底规范。
   - **2026-09-29 新增权威依据**：根文件 `CLAUDE_CODE_CODEX_QODER_MASTER_PROMPT.md`（全需求一次性总提示词）与四份文档同级作为验收依据；其 **§6 为最高优先级**：Fire/Water 必须由 `assets/dino/{fire,water}` 逐帧承担（下颌开合 + 喷射起点在口腔内），effects 仅作额外粒子/尾迹/落地，不得贴独立弹体冒充。据此已**移除 app.ts 对 FIRE/WATER 的口部特效叠加**（见 §2 复核记录）。
5. **项目地图**：`project_map.md` 为全文件路径与关系索引，新增/移动文件或改变模块关系时同步更新；开工查找代码先查它。
6. **双 tsconfig 编译模型**：
   - `tsconfig.json`：main/preload/shared → CommonJS → `dist/`；
   - `tsconfig.renderer.json`：renderer → ES2022 模块（type="module"）→ `dist/renderer/`；
   - renderer 现阶段不从 shared 导入运行时值（sandbox/ESM 隔离），如需共享保持「类型-only 导入」或将常量/数据**手工同步到 renderer 并加一致性单测**。需求扩展 E3 的 i18n 词条即采用此约定：`src/shared/i18n.ts`（主进程托盘用）↔ `src/renderer/i18n.ts`（设置页用）两份 STRINGS 由 `tests/unit/i18n.test.js` 断言完全一致（同 constants/preload 类型手工同步模式）。
7. **测试命令注意**：Node 22 + Windows 下 `node --test 目录/` 不可用，须用 glob：`node --test "tests/unit/**/*.test.js"`（已固化进 npm test）。
8. **lint 现状**：`npm run lint` = 双 tsconfig `--noEmit` 类型检查，未引入 ESLint；如 Phase 12 要求完整 lint 再评估加依赖。

---

# 2. 阶段记录（新条目倒序追加在最上面）

## 发布：打包 1.2.0 Windows 产物（Phase 13 T1302）—— ✅ 成功（2026-09-30）

> 收 i18n（E3）后按 minor 版本产出 1.2.0 安装包：`release/DinoPet-Portable-1.2.0.exe`（80.4MB）+ `DinoPet-Setup-1.2.0.exe`（80.6MB）+ `.blockmap`；`win-unpacked/DinoPet.exe` + `resources/app/node_modules/uiohook-napi` 均在位（免 VS 生效）。

### 踩坑与解法（沙箱网络受限环境）
- **@electron/get 缓存键与镜像 URL 绑定**：环境里已缓存 `electron-v37.10.3-win32-x64.zip`（127MB，位于 `%LOCALAPPDATA%\electron\Cache`），但 `build:win` 仍按当前 `ELECTRON_MIRROR` 计算新缓存键 → **缓存不命中、重新下载**；本沙箱对 GitHub/npmmirror 均严重限速（4 分钟才 39%，ETA 十几分钟）。
- **强杀下载进程留陈旧锁**：中途 kill electron-builder 会在 `%TEMP%\eb-dl-*.lock.lock` 留下 `proper-lockfile` 锁目录，后续 run 报 `Lock file is already being held` 直接失败退出 → 须手动删除该 `.lock` 目录。
- **决定性免下载解法 `electronDist`**：临时配置加 `electronDist: node_modules/electron/dist`（已解包的同版本 37.10.3，`dist/version`=37.10.3 校验一致），electron-builder 直接 copy 本地解包件、**跳过 electron zip 下载**；nsis/winCodeSign 走既有缓存。用 `npx electron-builder --win --config electron-builder.pack.yml`（临时 yml 复用主配置字段），产物核对后**删除临时 yml**，不污染仓库 `electron-builder.yml`。

## 需求扩展 E3：托盘 + 设置窗口中英双语 i18n —— ✅ 自动化验收全绿（2026-09-30）

> 用户排队需求：“托盘的所有选项和内容，默认都要有中英文展示，可以选择语言，默认英文”。经 AskUserQuestion 细化两项决策：**默认纯英文显示**（非双语在前）+ **覆盖范围 = 托盘菜单 + 设置窗口**。

### 设计
- **单一真相 `language`**：新增到 `DinoConfig`（`'en'|'zh'`，`DEFAULT_LANGUAGE='en'`），`clampConfig` 用 `oneOf` 归一（非法回落 en）。语言变更走既有 `onConfigChanged`（已同时 `tray.refresh()` + 广播 `dino:config-changed` 给设置窗）→ **无需新增 IPC 通道**。
- **词条字典双副本**（因 `tsconfig.renderer.json` rootDir=src/renderer，renderer ESM 无法 import shared）：`src/shared/i18n.ts`（权威，主进程托盘直接 import）+ `src/renderer/i18n.ts`（手工同步副本，settings.ts import）；两份 `STRINGS{en,zh}` 约 33 键。语言名 `lang.en`/`lang.zh` 恒为 “English”/“简体中文”（母语名不随界面语言翻译，防误选后迷路）。
- **托盘** `tray-manager.ts`：Pause/Direction/Speed/Behavior/Settings/Exit 全走 `t(lang,key)`；新增 **Language 子菜单**（radio English/简体中文）。
- **设置窗** `settings.html`/`settings.ts`：静态中文标签改为 **英文默认（匹配默认语言，无 JS 也不闪中文）+ `data-i18n` 键**；settings.ts `applyI18n(lang)` 刷新 document.title / `<html lang>` / 所有 `[data-i18n]`，显示器下拉按语言重渲染（主显示器默认/主屏标记），新增 **Language 选择控件**。主进程 `window-manager.createSettingsWindow` 初始标题改为语言中性的 `APP_NAME`（避免加载前中文闪现）。

### 验证
- 手工同步的 DinoConfig 共 4 份副本同步加 `language`：`shared/config-schema.ts`（权威）/ `preload.ts` / `renderer/app.ts`（dinoAPI 返回类型）/ `renderer/settings.ts`。
- `npm run lint`（双 tsconfig --noEmit）绿；`npm test` **88/88**（新增 `tests/unit/i18n.test.js` 6 条 + config-schema 1 条 language 用例）；其中 i18n 一致性单测把两份 STRINGS `deepStrictEqual`，锁死漂移。
- 静态交叉校验：settings.html 内 22 个 `data-i18n` 键全部在字典命中（无裸键风险）。`npm run dev` 冷启动干净（旧 config 无 language → clamp 回落 'en'，符合默认纯英文）。
- 遗留：语言切换的最终目检需用户现场右键托盘 → Language → 简体中文，并打开 Settings… 验证两侧同步切换（本环境自动截屏不可靠，见 Phase 13 T1303 结论）。

---

## Phase 13 T1303 截图取证工具 + 首张实拍—— ✅ 工具+idle 实拍完成（2026-09-30）

> 用户委托“你来截图”。验证：本环境实为真实桌面（150% 缩放），GDI 截图能拍到透明置顶窗的恐龙，画面具代表性。

### 新增（均为开发期工具，不参与打包）
- `scripts/capture-screen.ps1`：DPI 感知全屏/区域截图（SetProcessDPIAware + CopyFromScreen），输出物理分辨率 PNG。
- `scripts/crop-png.js`（pngjs）：按坐标从全屏裁特写。（曾尝试 grab-dino/scan-action/hunt-dino/find-dino-center/fire-shot 自动定位+合成拖拽，但在本机环境下不可靠，已全部删除，只留上述两个干净工具。）
- 成品：`screenshots/dino-on-desktop.png`（idle 特写，干净草地、无隐私）。全屏中间帧（含用户桌面图标/文件）一律 `.gitignore` 排除（screenshots/raw/ + _probe.png），仅精选特写入库。
- 未得（自动）：喷火/吐水动作帧。原因：用户开着 IDE且其预览窗里正显示一只大绿恐龙（骗过绿定位）+ live 宠物四边持续移动（定位→拖拽竞态）+ PowerShell 子进程 DPI 空间与 capture-screen 不一致。合成拖拽虽最坏仅选中图标（不会启动），但多轮扑空后停手不再扰用户桌面。→ 动作帧改由用户现场手动抓：拖一下恐龙（或点桌面让它走过去）触发特效，同时 `powershell -File scripts/capture-screen.ps1 -OutFile screenshots/raw/fire.png`，再 `node scripts/crop-png.js` 裁特写。

## Phase 13 补充：自定义图标 + 原生依赖免 VS 打包（随 1.1.0）—— ✅ 完成（2026-09-30）

> Phase 13 当初“0 运行时依赖”前提被需求扩展④（uiohook-napi）推翻，`build:win` 因此首次真实验证。

### 修改
- **自定义应用图标**：新建 `build/icon.png`（256×256，直接复用官方 `assets/dino/idle/01.png`、非伪造新美术）；`electron-builder.yml` 的 `win.icon` 指向它，构建自动生成多尺寸 `icon.ico`（已验 `.icon-ico/icon.ico` 20KB）嵌入 DinoPet.exe。
- **原生依赖免 VS 打包**（关键修正）：④引入 uiohook-napi 后，electron-builder 默认 `@electron/rebuild` 会调 node-gyp 重编译→本沙箱无 VS 直接失败（`Could not find any Visual Studio installation`）。但 uiohook-napi 用 **prebuildify 预编译 N-API** `prebuilds/<plat>-<arch>/*.node`（跨 Node/Electron ABI 稳定，`electron .` 能直跑即为证）。→ 配 **`npmRebuild:false`** 跳过重编译（日志 `skipped dependencies rebuild reason=npmRebuild is set to false`）；并将 `node_modules/uiohook-napi/**`（仅 win32，剔 darwin/linux）+ `node-gyp-build` 加载器显式加入 files。

### 验证
- `npm run build:win` 成功（BUILD_EXIT=0）：产出 `DinoPet-Portable-1.1.0.exe` / `DinoPet-Setup-1.1.0.exe` / blockmap；win-unpacked 内 prebuilds 仅 win32-arm64/x64、node-gyp-build 已入包、icon.ico 已生成。
- 未启动打包 exe 冒烟（避免干扰用户真机 soak）；`win-unpacked/DinoPet.exe` 由用户 soak 结束后自愿验证。
- 遗留：`release/` 内旧 `*-1.0.0.exe` 为 gitignore 产物、因超 20MB 工具限制未删，可手动清。

## Phase 10 性能微调：主循环按需重绘（透明置顶窗降载）—— ✅ 代码完成（2026-09-30，真机 soak 进行中）

> Phase 14 内存基线采样时发现渲染器进程工作集高达 ~1GB+、日志长刷 `cc/tiles/tile_manager.cc WARNING: tile memory limits exceeded`，且 CPU 偏高。定位：主循环 `createGameLoop` 每帧（rAF ~60fps）**无条件** `drawCurrent()`（内含 `clearRect`+`drawImage` 全画布），而动画实际帧率仅 ~12fps；每次整面重绘会把 transparent+alwaysOnTop 分层窗口标脏、逼合成器以 60fps 重新合成。

### 修改
- **按需重绘门控（app.ts 主循环）**：仅当「主体动画 id/帧号变化 `OR` 朝向 isFlipped() 变化 `OR` 有活动特效（需逐帧刷叠加）`OR` 特效刚由活动转结束（需补画一次清掉残影）」时才 `drawCurrent()+drawEffects()`；否则跳过，canvas 自保留上一帧完整合成（窗口位移由主进程 move，与重绘无关）。idle 重绘从 60fps 降到 ~12fps（约 1/5）。
- **`EffectPlayer.hasActive()`**（新增）：`engine.renderables().length > 0`，空闲无特效时正确为 false（EffectEngine.instances 空）。纯逻辑模块新增方法，不改现有接口、单测不受影响。

### 环境定性（重要）
- 本沙箱 **无 GPU 硬件加速** → Electron 回退软件合成（SwiftShader），透明分层窗瓦片内存打满 Chromium 固定预算，故此处工作集虚高且刷瓦片告警；主进程**并未**调用 `disableHardwareAcceleration`（查无 GPU 开关）。真机默认硬件加速下应显著下降。
- 工作集**上下震荡、可被 OS 回收 → 非单调泄漏**，不违反“无持续增长”验收。真实数值需用户带 GPU 机器用任务管理器采（soak 进行中）。

### 验证
- `npm run lint` 0 / `npm test` **81·81** / 单实例干净重启。
- 用户目检：按需重绘后 idle/walk/turn 与 fire/water/tail/jump/sleep 特效均**正常、无卡帧/无残影**（✅ 2026-09-30）。待真机 30–60min soak 回报内存区间。

## 需求扩展 E2：④ 指路走过去（全局左键钩子 + 直线走向 + 小太阳）—— ✅ 完成并经用户目检（2026-09-30）

> E1 的④「托盘指路模式 + 全屏 overlay 捕点击 + 沿边行走」经用户多轮实测否决，本条为其**替代实现**。③ 拖完喷火（E1）保留、已验收。

### 需求演进（同一功能五轮打磨）
1. 托盘「Walk to…」+ 全屏 overlay 捕点击 → 用户否决（点完要立即回桌、不想进特殊模式）。
2. 全局鼠标钩子（uiohook-napi），**Alt+左键** → 用户嫌多按一个键。
3. **纯左键**、只追最新一次点击 → 生效但“时灵时不灵”。
4. 诊断定位“恐龙只贴四边走、对面/上下点击要绕半周长”→ 用户选**直线走向点击点**。

### 最终实现
- **全局钩子（main.ts）**：`uiohook-napi` 被动钩子 `uIOhook.on('mousedown')`，`startWalkToHook()`/`stopWalkToHook()`（onExit）。左键(button=1) 即触发；落点用 `screen.getCursorScreenPoint()`（DIP，非 uiohook 物理像素）。每次点击 `moveToTarget` 覆盖旧目标 = “只追最新、放弃旧”。
- **点恐龙守卫**：仅当 `clickThroughMode==='interactive'`（渲染器判定光标压在恐龙 sprite 上）且点击落在窗口内才跳过指路——避免整窗 128×128（96 恐龙 + 16 透明余量）误吞贴边恐龙旁的桌面点击。
- **直线走向（movement-engine）**：target 模式重写为**绝对坐标线性逼近** `absTarget`（按直线步进、水平分量定 facing）；到达发 `dino:arrived` → 短暂 IDLE → `nearestEdgePoint` 贴回最近边恢复 patrol。移除周长绕行（`stepMove` 仍服务 patrol）。
- **小太阳（sun-marker）**：`createSunMarkerWindow(x,y,size)` 每次点击在落点居中**新建**瞬时窗（无边框/透明/alwaysOnTop screen-saver 级/`setIgnoreMouseEvents(true)` 全透/无 preload），页面加载即自播淡入淡出 CSS 动画，`showSunMarker` 于 `SUN_MARKER_MS` 后 `close()` 销毁（**复用即销毁**，避免 show/hide 穿透与残留）。无独立 IPC（仅 `dino:arrived` 一个到达通道）。
- **队列↔移动互斥（app.ts）**：新增 `interruptQueue()`；`applyMovementState` 见恐龙为指路重新起步（activity=target & phase=walk）而队列仍在跑 → 清空队列，防喷射动画里滑屏。
- **到达吐水**：`onArrived` → `enqueueActions(['WATER','WATER','WATER'])`（§6：水柱由角色帧承担）。

### 依赖与作废
- **新增首个运行时依赖 `uiohook-napi ^1.5.5`**（用户批准；prebuildify 预编译 N-API .node，免 node-gyp/VS 编译）。
- 作废并移除：`point-capture.html` overlay、`dino:point-click/cancel` 通道、`createPointOverlayWindow/enterPointMode/leavePointMode`、托盘 `onPointMode` 入口、`perimeterArc/walkDirToTarget`（直线后移除）。`dino:arrived` 通道保留。

### 关键坑（沉淀）
1. 整窗矩形守卫误吞桌面点击 → 用渲染器 `interactive` 命中信号而非整窗 bounds。
2. 贴边模型上下点击绕半周长 → 改直线走向。
3. 队列与 target 移动并发滑屏 → interruptQueue（tick 里 target 块不受 enabled/paused 门控）。
4. PowerShell 强杀同名 `electron`（Qoder 亦 Electron）按 PID 且先核对 Path。

### 验证
`npm run lint` 0 / `npm test` 81·81 / `npm start` 干净重启 4 electron 进程无钩子报错；用户目检“OK 基本没问题”。临时诊断（diag/fs）与死代码已清理。

## 需求扩展 E1：③ 拖完喷火×3 /（④ 初版 L1 指路，已被 E2 取代）—— ③✅验收 · ④→E2（2026-09-30）

> V1.0.0 验收后用户新增两条交互需求；按 **L1 方案**实施：指路模式（全屏透明 overlay 捕一次点击）+ **共用一次性动作队列**（相邻含短间隔、新触发**清空旧队列**）。

### 需求
- ③ 鼠标拖动恐龙到任意位置，松手 → 吐火 ×3（相邻含短间隔）。
- ④ 托盘「Walk to…(指路模式)」→ 全屏点选桌面某处 → 恐龙沿边慢慢走过去 → 到达 → 吐水 ×3（含短间隔）。

### 实现（11 文件）
- **IPC 通道**（`shared/constants.ts`，preload 手工同步）：`dino:point-click`、`dino:point-cancel`、`dino:arrived`；`ACTION_GAP_MS=180`（app.ts 内联镜像）。
- **指路模式（main）**：`window-manager.createPointOverlayWindow(bounds)` 全屏透明 screen-saver 级 overlay（复用 pet preload）；`main.enterPointMode/leavePointMode`（**15s 无点击自动超时**）；新页 `src/renderer/point-capture.html`（内联 JS：左键→pointClick / 右键·Esc·失焦→pointCancel + 顶部提示 pill）。`ipcMain(POINT_CLICK)` 用**主进程权威** `screen-manager.cursorScreenPoint()` 取落点→`movement.moveToTarget`→关 overlay（不信任 sandbox overlay 自带坐标）。`tray-manager` 菜单加「Walk to…」入口 `onPointMode`；`onExit` 收起 overlay。
- **到达事件（movement-engine）**：`moveToTarget` 到达（`crossed` 分支、`target=null` 后）向宠物 renderer `send(dino:arrived)`——一次性、非高频（合 SKILL §23）。
- **动作队列（app.ts + 新 `state/ActionQueue.ts` 纯类）**：`enqueueActions([...])` = 新交互**清空旧队列**(`ActionQueue.start`)并立即播首个；`onQueuedActionFinished` 在 one-shot 播完回调里按 `ACTION_GAP_MS` 用 `setTimeout` 间隔接续下一个，播完 `finishAction` 回基态。`playQueuedAction` 直接 `engine.setAnimation`（利用引擎 finished 时同名复位重播，绕过 `applyStateOutput`「同动画不重设」门控）；拖动抢占（activity=drag）则 `clear` 放弃队列。`currentInput()` 用 `queueActive` 压制 `movingToTarget`（防到达后 2s IDLE 停顿期 MOVE_TO_TARGET 抢占吐水）并将队列视同交互中以屏蔽随机行为。
- **触发点**：`endDragIfNeeded()`（拖完松手）→ `enqueueActions(['FIRE','FIRE','FIRE'])`；bootstrap 订阅 `onArrived` → `enqueueActions(['WATER','WATER','WATER'])`。遵循 master prompt **§6**：FIRE/WATER 不叠加 effects 弹体（由角色口内一体化喷射帧承担）。

### 验证
- `npm run lint` PASS（0 错误）。
- `npm test` **81/81**（新增 `tests/unit/action-queue.test.js` 5 条：start 返回首个+next 顺序 drain+pending、新 start 清空旧队列、空数组→null、clear、只读源数组 slice 拷贝不被破坏；原 76 无回归）。
- `npm start` 正式模式启动无 `[ERROR]`/`[PERF]`（v1.0.0，dev=false）。

### 待人工目检（本机 GUI，透明置顶窗无法由本环境截图）
- 拖动松手→喷火×3 有明显短间隔；托盘 Walk to…→全屏点选→走过去→到达吐水×3 有短间隔；指路 overlay 右键/Esc/失焦/15s 超时均取消；播放中再次拖动或新到达应打断旧队列。

### 遗留/边界
- 版本：用户已裁定将③④两条扩展 **bump 至 1.1.0**（package.json / package-lock / CHANGELOG `[1.1.0]` 已同步）；Git 按协议仍**未提交**（待项目最终完成后统一 commit）。

## Phase 14：最终验收 —— 🟡 自动化项全绿（2026-09-30，待人工目检 + Git 授权）

### 版本收口
- package.json / package-lock.json 版本 0.1.0 → **1.0.0**（对齐 CHANGELOG `[1.0.0]` 与 TASK_LIST「V1.0.0 READY」）；重打包产出 `release/DinoPet-{Portable,Setup}-1.0.0.exe`，删除过期 0.1.0 产物；打包内 `resources/app/package.json` version=1.0.0。

### 自动化验收（TASK_LIST Phase 14 清单，可脚本化项全绿）
- `npm run lint` PASS（0 错误，dinopet@1.0.0）。
- `npm test` **76/76**（unit + Config 集成，无回归）。
- `npm ci --dry-run`「up to date」→ package.json 与 lockfile 同步，README 的 `npm ci` 安装路径可用（未做破坏性全量重装：Electron 二进制需本机镜像环境变量）。
- `npm start` 正式模式：日志仅 `[INFO] started (dev=false, version=1.0.0)` + 窗口定位；**无 `[PERF]`/DevTools/console 转发**（dev-only 正确门控），稳定无报错。
- `npm run build:win` 成功；`win-unpacked/resources/app/` 下 `assets/dino/{idle,fire}`、`src/renderer/{index,settings}.html`、`dist/{main/main,renderer/app}.js`、`package.json` 均存在（asar:false 布局与可运行 dev 一致）。
- **无残留进程**：验收后 `Get-Process electron` 计数 0。

### 待人工最终确认（本机 GUI，透明置顶窗无法由本环境截图）
- 目检：正式模式只剩一只恐龙（无调试面板/阴影/按钮，CSS 优先级修复后）、动画无明显问题、点击穿透/DPI 无明显异常。
- 1h 内存 soak（Phase 10 `[PERF]` 采样）、多屏拔出迁移、开机自启（打包版写注册表）。
- Git 统一提交/推送：按协议留待项目最终完成，需用户授权（见下）。

## Phase 13：发布 —— ✅ 完成（T1301/T1302/T1303 无图部分；截图/demo 待用户本机）

### T1301 README（✅ 定稿）
- README.md 按 V1 完成态全重写（替掉早期骨架的 `npm install`/`<repo-url>`占位/“能力逐步上线”等过期描述）：特性清单、环境要求、**T1301 必需块 `git clone → cd → npm ci → npm start`**、开发/正式区别（呼应刚修的“正式只剩恐龙”）、命令表、鼠标+托盘操作、配置位置(%APPDATA%/DinoPet/config.json)、技术栈、素材许可（DinoPet Final Asset Pack）、已知限制、路线图、MIT。
- 未内链截图（screenshots/pet.png 属 T1303，且透明置顶窗需用户本机捕获），暂不引用避免断链。

### T1302 Build（✅ 完成，用户已批准引入 electron-builder）
- 新增 devDependency `electron-builder`（项目首个新增依赖，仍零运行时依赖）；package.json 加 `build:win` 脚本；新建 `electron-builder.yml`。
- 关键决策：**`asar: false`**——主进程按 `dist/main/../../src/renderer/index.html` 相对路径 loadFile、`nativeImage.createFromPath` 读托盘图、renderer 用 `../../assets/...` file:// ，均需真实文件路径；禁用 asar 使打包目录布局与可运行的 `electron .` 一致，避免 asar 内 nativeImage/相对定位不稳定（electron-builder 会就 asar:false 告警，属预期取舍）。
- `files` 仅纳入 dist / src/renderer / assets / effects / package.json；target = portable + nsis；产物输出 `release/`（已 gitignore）。
- **实际构建验证**：`npm run build:win` 成功产出 portable + nsis 两产物（首建时 version=0.1.0；**Phase 14 已统一收口为 1.0.0**，见上）；`win-unpacked/resources/app/{assets/dino/idle/01.png, src/renderer/index.html, dist/main/main.js}` 均存在。默认 Electron 图标（未设自定义，待定）。GUI 目视验收需用户本机跑 exe。

### T1303 GitHub（🟡 无图部分完成）
- 已备：README（T1301）、LICENSE（MIT，已有）、CHANGELOG.md（新建，V1.0.0 release notes 源）。
- 待办：screenshots/ 与 demo GIF（用户选“先做无图部分”）；仓库 URL + push 按用户决定 **Phase 14 验收后统一 commit+push**（现阶段不动 git）。

## Phase 12：测试 —— ✅ 完成（2026-09-30，待人工执行 Manual 清单）

### Unit（已全覆盖，无新增）
- 核对 Phase 12 必覆盖七项均已有用例：EdgePath/Direction/Movement（movement.test）、BehaviorSelector/Cooldown/StateMachine（state-machine.test）、Config（config-schema.test）；额外动画/特效/几何/资产一致性。共 `tests/unit/` 8 文件。

### Integration
- **可自动化（Config）**：`config-manager.createConfigManager(filePath?)` 加可选注入（默认仍 userData，main 无参调用不变）；新增 `tests/integration/config-persistence.test.js` 5 例（真 fs 临时目录）：set 落盘→新实例读回、坏 JSON 回落、非法值 clamp 后落盘、subscribe 通知/退订、目录递归创建。纯 Node 传 filePath 短路不触达 electron app。
- **Electron/IPC/Tray**：需活体 Electron，不引入重型测试依赖（合纪律），归入人工清单。
- `npm test` glob 由 `tests/unit/**` 扩为 `tests/**`（纳入集成测）；总数 **71→76/76**。

### Manual
- 新增 `tests/manual-checklist.md`（Phase 12 强制交付）：Unit 覆盖表 + Integration 自动/人工划分 + 启动/行为流/交互/托盘/配置持久化/系统能力/异常/性能 逐项勾选清单（含 TASK_LIST §Manual 主链）。

### 测试
- `npm run lint` PASS；`npm test` **76/76**（+5 Config 集成）；`npm run dev` 重启稳定、单实例正常。

### 缺陷修复（人工目检发现：正式模式误显示调试面板）
- 现象：`npm start`（dev=false）下仍看到深色矩形底 + `Dir/Move/Mode` 静态按钮。
- 根因（CSS 优先级）：`styles.css` 中 `#debug-panel{display:flex}`（ID 特异度 1,0,0）压过 `.hidden{display:none}`（类 0,1,0），导致带 `class="hidden"` 的面板仍显示（Dir/Move/Mode 为 index.html 静态钮，动画钮才需 buildDebugPanel 动态建）。此 bug 同时影响早期各阶段。
- 修复：`.hidden{display:none !important}` 强制压过 ID 规则；dev 仍由 `buildDebugPanel` `remove('hidden')` 正常展示面板。

### 遗留/待人工确认
- 需用户按 `tests/manual-checklist.md` 完整跑一轮（尤其 Electron/IPC/Tray 与 1h 内存 soak）；本环境无真实 GPU，集显/独显机器上重测 `getGPUFeatureStatus`。

## Phase 11：异常处理 —— ✅ 完成（2026-09-30，待人工拔屏/Explorer 重启核验）

### 概述（PRD §稳定性；TASK_LIST Phase 11 六场景）
- **程序重复启动**（已实测）：`app.requestSingleInstanceLock()`，非主实例 `app.quit()` + `whenReady` 内 `if(!gotSingleInstanceLock) return` 不建窗；主进程 `app.on('second-instance')` → 唤已有窗口到前台 + 重挂 `setAlwaysOnTop(true,'screen-saver')`。实测：第二个 `electron .` 立即退出，主进程日志 `second launch ignored`。
- **主进程异常清晰日志**：顶层 `process.on('uncaughtException'/'unhandledRejection')` → `[ERROR]` 日志不静默退出（后台宠物尽量存活）。
- **窗口异常可恢复**：createWindow 内 `webContents.on('render-process-gone'/'unresponsive')` → 日志+`reload()`（重载后 did-finish-load 重推行状态）；`did-fail-load` 仅日志诊断不自动重载（防本地资源缺失时重载循环）。
- **显示器拔出/分辨率变化**：Phase 9 `watchDisplayChanges`+`handleDisplaysChanged`（配置屏>当前屏>主屏降级+`setWorkArea` 幂等重定位）已覆盖，均 null 守卫不崩溃。
- **全屏应用**：宠物窗 `screen-saver` 层级故意浮于全屏之上（产品选择），不崩溃。

### 测试
- `npm run lint` PASS；`npm test` **71/71**（无新单测：均为 electron 主进程集成行为）；`npm run dev` 主实例正常获锁启动；**双实例实测**：第二实例退出、主实例 `second launch ignored` 日志。

### 遗留/待人工确认
- **Explorer 重启**：Electron Tray 图标在 explorer.exe 重启后可能丢失（系统级限制，无直接事件），V1 已知限制——重新启动程序（经单实例 second-instance）会重新唤回宠物+重挂置顶；彻底修复需壳层监控，超出 V1。
- 拔屏自动迁移/分辨率变化不崩溃需多显示器环境人工触发（本机单屏）。
- render-process-gone 自恢复难以主动触发，靠代码保障（重载逻辑已接）。

## Phase 10：性能优化 —— ✅ 完成（2026-09-30，待人工 1h 内存 soak）

### 审计（T1001 CPU / T1002 内存 / T1003 GPU；禁止高频无意义 setInterval/每帧日志/无限粒子/高频 IPC）
- **CPU（T1001）**：主进程 16ms setInterval 为窗口定位循环（main 无 rAF，属设计例外），paused/!enabled 时早退；渲染主循环用 rAF（合 TECH_DESIGN §14）。**无每帧日志**（console 均一次性 boot/preload）；**无高频 IPC**——movement `emit()` 状态 key 不变不发（稳态行走 key 恒定→零 IPC），拖动时窗口位置走 setPosition 不走 IPC，setInteractive 幂等。
- **内存（T1002）**：Sprite 启动一次性预加载缓存（sheets/effect map，每帧仅 drawImage 不重载）；EffectEngine 一次性实例播完 done 即每帧 `filter` prune，循环特效离开状态时 `cancel`——无粒子泄漏。
- **GPU（T1003）**：仅 96px 单精灵/帧，软件渲染下也极低负载；启动一次 `app.getGPUFeatureStatus()` 可观测。

### 实现（将 T1002 可测量）
- main.ts 新增 **dev-only** 低频（30s）内存采样：`process.memoryUsage()` + `app.getAppMetrics()`（逐进程 workingSetSize）输出 `[PERF] main rss=.. heap=.. | Browser=..MB GPU=.. Utility=..`；启动一次 `getGPUFeatureStatus()`。均包在 `if (isDev)` 内，**生产零开销**；`perfTimer` 退出时 clearInterval。

### 测试
- `npm run lint` PASS（修正 `ProcessMetric.type` 非 processType）；`npm test` **71/71**（无新单测）；`npm run dev` 基线 `main rss≈82.6MB heap≈4.6MB`、GPU 状态正常输出、运行稳定。

### 遗留/待人工确认
- **连续 1 小时内存 soak**需用户挂机观察 `[PERF]` 日志趋势（应平台而非持续上升；缓慢增长后稳定属正常 GC，单调不回落需排查）；也可用任务管理器交叉验证。
- 本环境 GPU 为 software 渲染（disabled_software）；真实独显/集显机器上应为 enabled_on，但无论软硬渲染 96px 单精灵负载均极低。

## Phase 9：系统能力 —— ✅ 完成（2026-09-30，待人工确认多屏拔出/自启）

### 概述（TECH_DESIGN §21 多显示器 / §2 Screen Manager；T901 开机自启 / T902 多显示器 / T903 DPI）
- **T902 显示器监听+迁移**：`screen-manager` 新增 `watchDisplayChanges`（监听 display-added/removed/metrics-changed，返回退订函数；因 Screen 事件重载不同需逐个显式注册）+ `displayExistsById`/`workAreaOfDisplay`/`displayIdAtBounds`/`primaryScaleFactor`。main 新增 `handleDisplaysChanged`：目标屏优先级 = **配置屏(在线) > 当前所在屏(在线，度量变化取新工作区) > 主屏**；当前屏拔出→`movement.setWorkArea` 幂等重定位（重算周长+投影落位+移动窗口）；`whenReady` 注册监听、`onExit` 退订。启动/配置切换时同步维护 `currentDisplayId`。
- **T903 DPI**：坐标全程 DIP（workArea/setPosition 均为 DIP，Electron 自动缩放 backing store），代码无需特殊适配；**本机实测 scaleFactor=1.5（150%）下窗口定位正常**（workArea 1707×1019、恐龙 y=890 在界内）；dev 启动日志输出 `primary display: scaleFactor=...`。
- **T901 开机自启**：沿用 Phase 8 `applyConfig`→`app.setLoginItemSettings({openAtLogin})`，配置开关驱动，无新增代码。

### 测试
- `npm run lint` PASS；`npm test` **71/71**（无新测：显示器逻辑依赖 electron `screen` API，属集成/人工验证，归 Phase 12）；`npm run dev` 重启后 `sprites/effects preloaded`、DPI 日志正常、运行稳定。

### 遗留/待人工确认
- 多显示器拔出自动迁移、拖入副屏边界需**双显示器环境**人工核验（本机单屏仅被动验到 DPI）。
- T901 自启在打包后才真正写注册表（dev 下 `setLoginItemSettings` 指向 electron.exe，无持久副作用），归 Phase 13 发布验证。

## Phase 8：配置 —— ✅ 完成（2026-09-30，待人工确认设置窗/持久化）

### 架构（TECH_DESIGN §19 配置 / §20 IPC / §21 多显示器；PRD §13 夜间 / §15 持久化；T801/T802）
- **单一真相**：Config 成为运行期唯一配置源。新增 `src/shared/config-schema.ts`（纯：DinoConfig/DEFAULT_CONFIG/clampConfig/speedModeToPx/isNightHour）+ `src/main/config-manager.ts`（`app.getPath('userData')/config.json` 读写，禁写项目目录/禁数据库，加载与写入均过 clampConfig 归一，坏配置回落默认不崩）。
- **应用链**：main `applyConfig(cfg)` 将配置分发到各子系统——方向/速度→engine、显示器→engine.setWorkArea、行为→IPC `dino:behavior`、穿透→clickThrough 门控、自启→app.setLoginItemSettings、夜间→时段内限慢速。`config.subscribe(onConfigChanged)` 统一触发 applyConfig + tray.refresh + 向设置窗广播 `dino:config-changed`。
- **托盘重构**（tray-manager）：Direction/Speed/Behavior 改为调 `update→config.set`（不再直改引擎/自维镜像），菜单勾选从 `config()` 回显；新增 `refresh()` 供外部变更刷新；Settings… 启用→openSettings。

### 设置页（T802，轻量无 SPA）
- 新增 `src/renderer/settings.html` + `settings.ts`（普通有框小窗，window-manager.createSettingsWindow，复用同一 preload）；控件变更即 `dinoAPI.setConfig(partial)` 落盘并即时生效，订阅 onConfig 与托盘双向同步；显示器下拉由 `dino:get-displays` 填充。

### 关键实现
- `constants.ts` 新增 4 个 IPC 通道（GET_CONFIG/SET_CONFIG/CONFIG_CHANGED/GET_DISPLAYS）；`movement-engine` 新增 `setWorkArea`（重算周长+投影落位）；`screen-manager` 新增 `listDisplays`/`getDisplayWorkArea`；`preload` 新增 getConfig/setConfig/onConfig/getDisplays。
- 夜间模式：启动 applyConfig 按当前时段生效 + 60s 低频 `checkNight` 仅在夜间态翻转时重应用（非高频、无每帧日志，合 T1001）。
- renderer 全局 `dinoAPI` 类型仅在 app.ts 单处声明（settings.ts 不重复声明，避免 TS2717 冲突）。

### 测试
- `npm run lint` PASS；`npm test` **71/71**（+7 config-schema：clampConfig 回落/合法/枚举非法/monitorId 归一/字段齐全 + speedModeToPx + isNightHour）；`npm run dev` 重启后 `sprites/effects preloaded`、无配置/自启报错、运行稳定。

### 遗留/待人工确认
- 需人工：托盘 Settings… 打开设置窗、改方向/速度/行为即时生效且重启后保留（config.json）；自启开关在打包后才真正写注册表（dev 无副作用）。
- 显示器切换基础版（选目标屏即时迁移）已由 **Phase 9** 补完拔出/断开自动回退与 DPI 适配（见 Phase 9 记录）。
- 夜间模式仅实现“慢速”一项（PRD §13 还提“更高睡眠概率/更少特效”可后续扩展）。

## Phase 7：托盘 —— ✅ 完成（2026-09-29，待人工确认托盘菜单交互）

### 架构（TECH_DESIGN §2 Tray Manager；PRD F002/F003；T701 菜单 / T702 暂停）
- 新增 `src/main/tray-manager.ts`：`createTray({engine,win,onExit})` 返 `TrayController{destroy}`；main 模块级 `tray` 引用防 GC。图标复用正式 `assets/dino/idle/01.png` 缩 16px（真实 IP 素材，缺文件空图兜底不崩溃）。
- 菜单：Pause/Resume（切换标签）、Direction（Clockwise/Counterclockwise/Random 单选）、Speed（Slow45/Normal75/Fast110 单选）直控引擎；Behavior→Random behaviors（复选）经 IPC `dino:behavior` 下发 renderer；Settings… 禁用占位（Phase 8）；Exit→onExit。
- 控制分域：移动相关（暂停/方向/速度）主进程直改引擎；随机行为属状态机（renderer），走 IPC。

### 关键实现
- `movement-engine.ts`：新增 `setPaused(b)`（仅冻结 patrol 自动位移，拖/目标等显式指令不受影响；暂停置 phase idle、恢复回 walk，重置 lastMs 不补 dt）、`setSpeed(px)`（walkSpeed 变量替换常量，patrol/target 共用）；`constants.ts` 加 `WALK_SPEED_{SLOW,NORMAL,FAST}`、`IPC_CHANNEL_BEHAVIOR`。
- `main.ts`：whenReady 建托盘；`onExit` 置 `isQuitting`→destroy tray→app.quit；`window-all-closed` 改为「非退出态不 quit」（托盘常驻模型，仅 Exit 真退）。
- `preload.ts` `onBehavior(cb)` 订阅；`app.ts` `behaviorEnabled` 变量 + `currentInput()` 透传；`StateMachine` 输入 `behaviorEnabled!==false` 门控掷骰。

### 测试
- 命令：`npm run lint` / `npm test` / `npm run dev`；结果：lint PASS；test **64/64**（+1 `behaviorEnabled=false` 禁用随机行为，含默认启用对照）；dev 重启后 `sprites/effects preloaded`、托盘创建无报错、运行稳定。

### 遗留/待人工确认
- 托盘菜单 Pause/Direction/Speed/Behavior/Exit 的实际点击效果需人工在系统托盘目测（透明置顶窗无法截图）。
- 托盘 Direction/Speed 直改引擎，未回灌 renderer 的 Mode 按钮显示（各自独立，V1 可接受）。
- 图标为 idle 帧缩放，16px 下可能偏糊；如需专用 .ico 待后续（不伪造）。打包（Phase 13）需把 assets/dino 纳入 extraResources 否则托盘图标走空图兜底。
- Settings… 禁用占位，Phase 8 接入轻量设置页 + 配置持久化。

## 2026-09-29 素材/文档更新复核 —— ✅ 已处理（无回归）
- **变更**：`README_ASSETS.md` 缩为短版（规则不变）；`asset-manifest.json` 内容一致（仅 fire/water 加 `criticalAcceptance` 元数据）；`assets/dino/*` 帧图重新导出（**帧数完全不变**）；新增根文件 `CLAUDE_CODE_CODEX_QODER_MASTER_PROMPT.md`。
- **影响核验**：`npm test` **63/63 仍全绿**（磁盘帧数/清单一致性未破）；磁盘逐目录帧数与 manifest 逐项吻合；effects 四组各 6 帧不变；`applyClickThrough` 已用 `setIgnoreMouseEvents(true,{forward:true})`，符合 master prompt §9。
- **目检新帧**：fire 03/06/08、water 06/08 已确认“下颌张开 + 火焰/水柱从口腔内起喷”的一体化实现（满足 §6）。
- **§6 对齐修改**：`app.ts` 移除 `syncEffectsForState` 与 `EFFECT_OF_ANIM` 中 FIRE→fire、WATER→water 的口部弹体叠加（新帧已自带喷射，叠加会双火焰）；保留 JUMP→dust、REACTION→sparkle、SLEEP→zzz。`EffectManifest` 保留 fire/water 定义（磁盘合法素材，仅不再口部叠加）。lint PASS；dev 重启后 `sprites/effects preloaded`、运行稳定无报错。

## Phase 6：鼠标交互 —— ✅ 完成（2026-09-29，待人工确认拖动/点击手感）

### 架构（TECH_DESIGN §17 点击移动 / §18 拖动 / §11 优先级 DRAGGED > USER_INTERACTION > MOVE_TO_TARGET > SPECIAL > IDLE > WALK）
- **拖动接管放主进程**（关键决策）：拖动时窗口需跟随系统光标，而 renderer 快速拖动会因光标移出窗口丢失 mousemove。故 `movement-engine` 在 `activity==='drag'` 时用 `screen.getCursorScreenPoint()` 每 tick 计算 `窗口左上 = 光标 - 抓取偏移`（偏移=按下时 clientX/clientY，CSS px=DIP），**无跳变、松手位置准确**；renderer 只在 mousedown+位移超阈时发 `dragStart{offset}`、mouseup 发 `dragEnd`。
- **移动引擎三活动模式**（movement-engine.ts）：`patrol`（沿四边巡逻）/ `target`（走向目标点，`crossed()` 判到点即吸附→IDLE 停 `IDLE_AFTER_TARGET_MS`=2s→恢复 patrol）/ `drag`。方法：`beginDrag/endDrag/moveToTarget/runAway`；`endDrag` 保松手位置、按最近边继续（perpendicular 不硬吸附）；`runAway` 随机挑足够远周长点。payload 新增 `activity`。
- **投影纯函数**：`shared/movement.ts` 新增 `nearestEdgePoint(x,y,rect)`（夹进合法范围→取最近边投影），拖动落位与点击目标共用（单测覆盖）。
- **IPC 扩展**：`dino:set-movement` payload 增 `dragStart/dragEnd/moveTo/runAway`，main 白名单校验（数值型）后路由到引擎；preload `setMovement` 类型同步。
- **状态机**（T401 扩展）：新增 `DRAGGED`（animation idle、moveEnabled false）与 `MOVE_TO_TARGET`（walk；到达 idle 相位时显示 idle、moveEnabled true）两态；`tick` 顶部按 §11 最高优先级短路（dragging→DRAGGED、movingToTarget→MOVE_TO_TARGET，均打断特殊动作）；`StateMachineInput` 加 `dragging/movingToTarget`；`movePhase` 闭包在非 patrol 活动下以引擎相位为准。
- **app.ts 鼠标接线**：`onPointerDown`（仅本体命中才起拖）/`onPointerMove`（超阈→dragStart、更新 hover、光标 grab/grabbing）/`onPointerUp`（拖动结束 vs 点击）；`registerClick` 分类：**单击→REACTION、双击→runAway(跑开=MOVE_TO_TARGET)、连点≥3→低概率(0.35)生气 FIRE**（PRD F008，含计时窗防误判）；`window blur` 兜底结束拖动防卡死；GameLoop 用 `currentInput()`（hover/drag/target 来自 `movementState.activity`）喂状态机。`userInteracting`=悬停或拖动，抑制随机。

### 测试
- `npm run lint` 双 tsconfig `--noEmit` **PASS**；`npm test` **63/63 PASS**（新增 movement 投影 4 条 + 状态机 drag/target 6 条）；`npm run dev` 构建通过、`sprites/effects preloaded`、运行稳定无 renderer 报错。

### 遗留 / 待人工确认
- **点击桌面的“远距离”移动**：默认点击穿透使桌面空白处点击落到后台应用，故真·桌面任意点点击移动需“交互态/托盘移动模式”（Phase 7+ 可扩）；本阶段 MOVE_TO_TARGET 能力已在引擎实现并测试，双击跑开即走该通道演示走向目标→到达→停顿→恢复。点击移动仅在恐龙交互区（本体+特效余量）内即时可用。
- 拖动落位采用“保松手位置 + 取最近边继续”，若拖到屏幕正中再松手，会沿最近边方向走至下一转角才完全贴合周长（有轻微重定位，属 V1 简化）。中屏拖放不常见，暂不引 A*（§17 V1 不做障碍寻路）。
- 拖动/双击/连点的手感阈值（DRAG_THRESHOLD_PX=4、DBL_WINDOW_MS=280、ANGRY_PROB=0.35）待人工目测微调。

## Phase 5：技能动画 —— ✅ 完成（2026-09-29，待人工确认特效表现）

### 架构（TECH_DESIGN §16 特效与主体解耦；README_ASSETS：effects/* 仅可选装饰、不得替代一体化 fire/water）
- **技能角色动画**：fire/water/tail/jump/sleep/reaction 均已有正式一体化帧（Phase 2 接入），Phase 4 状态机已能触发播发；本阶段补齐“主体动画 + 特效叠加”的完整技能表现。
- **特效层（新增，与主体解耦）**：
  - `src/renderer/effect/EffectManifest.ts`（纯）：5 个特效定义 fire/water/dust/sparkle/zzz，含 kind(sprite/text)/anchor(mouth|head|feet|center)/size/travel/loop + `validateEffects`。**zzz 无正式素材→kind=text 程序绘制“z”（诚实占位，不伪造 IP 美术）**。
  - `src/renderer/effect/EffectEngine.ts`（纯）：生命周期 spawn→update→renderables→destroy；一次性播完自动 prune（**火焰不残留** T501），loop(zzz) 幂等持续到 cancel；尾段 25% 淡出。
  - `src/renderer/effect/EffectPlayer.ts`（DOM 胶水）：一次性预加载 effects/ 精灵（复用 SpriteSheet，新增 `EFFECT_ASSET_BASE`）+ 委托 EffectEngine + 解析当前帧 img。
- **渲染**：`DinoRenderer` 新增 `drawEffect(img,opts)`/`drawEffectText(text,opts)`——**不 beginFrame/不清屏**，叠加在本帧恐龙之上；按锚点+朝向(front=flipped?-1:1)+progress*travel 定位，翻转时镜像弹体。`SpriteSheet` 构造函数加 `base` 参（默认 dino，特效传 effects）。
- **编排（app.ts）**：`applyStateOutput` 监听 `out.state` 变化→`syncEffectsForState`：FIRE→fire、WATER→water、JUMP→dust、REACTION→sparkle、SLEEP→zzz(loop)，离开 SLEEP→cancel zzz；GameLoop 每帧 `effects.update(dt)+drawEffects()`；dev 面板点播同步预览特效。

### 测试
- `tests/unit/effect.test.js` 9 条：validateEffects 无问题/**磁盘帧数与清单一致**/fire-water 嘴部弹体声明；一次性自动销毁/帧推进不越界/progress与淡出/loop 幂等与 cancel/多特效并存/update(dt≤0) 不推进。
- tsconfig.unittest include 加入 effect 纯逻辑两文件（EffectPlayer 依赖 DOM 不入）。`npm run lint` PASS；`npm test` **53/53 PASS**（44+9）；`npm run dev` 日志 `effects preloaded`，运行稳定无 renderer 报错。

### 遗留
- **T506 reaction 变体**：仅有单一 `reaction` 帧集，“惊喜/愤怒/双击特殊 reaction”需额外官方素材（不伪造）；本阶段实现单击/通用 reaction 动画+sparkle，多情绪变体待素材到位后按 placeholder→正式接入（Phase 6 双击/连点逻辑可复用）。
- effects/ 无官方帧数/fps/锁点清单（asset-manifest.json 只含角色帧），本阶段参数集中于 EffectManifest 可调；弹体锁点按 256 画布几何估算，待人工目检微调。
- 本次未将 effects 纳入 validate-assets.js（该脚本只校验角色帧）；effects 帧数一致性改由 effect.test.js 保障。

---

## Phase 4：动画状态机 —— ✅ 完成（2026-09-29，待人工确认行为表现）

### 架构（TECH_DESIGN §10 状态机 / §11 优先级 / §12 行为选择器 / §13 冷却；PRD §6/§7）
- **状态机 = 纯逻辑** `src/renderer/state/StateMachine.ts`（`DinoStateMachine` 类，零 DOM/Electron，tsconfig.unittest 编进 dist-unittest/ 供单测）：10 个状态 IDLE/WALK/RUN/TURN/FIRE/WATER/TAIL/JUMP/SLEEP/REACTION，`state→animation` 映射表；每状态有明确入口/出口（T401 无非法状态）。`tick(dt,input)` 每帧推进 + `finishAction()`（one-shot 播完回调）+ `trigger(state)`（显式触发）三个入口，对应 §10 的 enter/update/exit 语义（副作用在 app 层按输出变化执行）。
- **优先级实现（§11）**：SPECIAL（FIRE/WATER/TAIL/JUMP/REACTION）播放期间不被 movement 相位抢占，结束由 `finishAction` 交还基态——天然满足“用户/动作 > 随机 > IDLE/WALK”。`userInteracting` 输入抑制随机并唤醒 SLEEP。
- **BehaviorSelector 集中（§12，禁随机判定散落）**：`pickBehavior` 权重表 + 概率闸门（`triggerChance`，PRD 60% 正常走→0.4）+ 全局冷却 `globalCooldown` + 单动作 `cooldown` + 连续同动作上限 `maxRepeat`（PRD §7“不允许无限触发同一动作”）。rng 注入保测试确定性。
- **T402 转角 turn**：状态机基态遇 movement `turn` 相位→进入 TURN 播 turn 动画，相位回 walk→WALK；TURN 归基态（转角暂停由移动引擎自身处理，非动作锁）。
- **RUN/SLEEP 说明**：RUN 合法但暂无自然入口（random 表按 PRD §7 不含奔跑，速度区分留 Phase 8/10）；SLEEP 由持续行走 `baseSleepAfter` 秒后触发或手动，`sleepDuration` 定时/交互唤醒。

### IPC 与 renderer 接入（app.ts）
- 状态机成为**动画单一驱动源**（取代 Phase 3 的 movement→engine 直驱）：GameLoop 每帧 `stateMachine.tick(dt,{userInteracting:false})`→`applyStateOutput`（仅动画变化时 `setAnimation`=enter 语义 + HUD + 面板高亮）。
- **移动门控**：实际 `enabled = moveIntent(用户 Move 钮) && actionMoveEnabled(状态机输出)`，仅变化时 `setMovement` IPC（SKILL §23）。特殊动作/SLEEP 期间 `moveEnabled=false` → 停走原地播动作，`engine.onFinished`→`finishAction` 恢复移动。
- **movePhase 绑定移动意图**（非 main 回声 phase）：动作自停会让 main 报 idle，若据此判断会误切 IDLE，故用 `moveIntent ? (phase==='turn'?'turn':'walk') : 'idle'`，转角仍由真实 turn 相位驱动。
- **dev 面板点播保留 manualOverride**：点按钮冻结状态机直接预览动画，one-shot 播完（`onFinished`）或下个 movement 相位变化时交还驱动权；HUD 新增 `State:` 行。

### 测试
- `tests/unit/state-machine.test.js` 11 条：T401 基态跟随/触发特殊+finishAction 恢复/无非法状态(TURN 拒手动)/SLEEP 唤醒；T402 WALK→TURN→WALK 链；T403 概率闸门/权重抽样/冷却压制/maxRepeat 上限/多动作交替/交互禁随机。
- `npm run lint` PASS；`npm test` **44/44 PASS**（33+11）；`npm run dev` 稳定运行（窗口移动、10 组精灵加载、无 renderer 报错/无 IPC 异常）。

### 遗留
- `trigger()` 目前仅 dev/未来托盘·交互用；随机行为表现需人工长时间观察确认频率自然（默认 rollInterval 6s / triggerChance 0.4，参数集中 DEFAULT_BEHAVIOR，Phase 8 接入配置）。
- DRAGGED / MOVE_TO_TARGET（§10 有、§11 更高优先级）属 Phase 6，本阶段仅以 `userInteracting` 插桩点预留。
- 状态机动画切换在 dt=0 启动一次 + 每帧 tick，与 movement 引擎 idle 回声解耦，未发现抖动。

---

## Phase 3：四边移动 —— ✅ 完成（2026-09-29，待人工确认行走表现）

### 架构分工（重读 TECH_DESIGN §7~§9 后确定）
- **路径算法 = 纯函数** `src/shared/movement.ts`（零 Electron，单测直测）：`pathRect`（窗口左上角合法范围=工作区扣自身尺寸，解决§6“一半被裁掉”）、`nextEdge`（cw: TOP→RIGHT→BOTTOM→LEFT / ccw 反向）、`edgeEnd`（§7.1 四线段）、`facingOn`（横边=行进方向，竖边贴墙：RIGHT边朝右/LEFT边朝左）、`stepMove`（dt 推进+角点精确落位+turn 停顿 0.5s 再换边，§8 禁瞬移；random 模式角点掷骰换向；每段随机速度系数 0.75~1.25 = PRD F004；rng 可注入保测试确定性）。
- **移动引擎 = 主进程** `src/main/movement-engine.ts`：窗口位置只能 main 改，故循环在 main。16ms ticker + `Date.now()` 真实 dt（钳制 0.1s）——主进程无 rAF，TECH_DESIGN §9 的“禁 setInterval 作王要动画循环”针对帧率漂移，此处 dt 驱动不受定时器精度影响，已在注释说明。**setPosition 仅在整数坐标变化时调用**；状态（phase/edge/facing/moving）变化才 `webContents.send` 推 renderer（SKILL §23 零高频 IPC）。
- **参数**（shared/constants.ts）：`WALK_BASE_SPEED=75`（PRD F003 normal 档中值）、`TURN_DURATION_S=0.5`（turn 5f@10fps 刚好播完一遍）、`MOVE_TICK_MS=16`。

### IPC 与 renderer 接入
- 新通道：`dino:movement-state`（main→renderer 推送）、`dino:set-movement`（renderer→main 控制，白名单校验 {enabled?:boolean, mode?:'clockwise'|'counterclockwise'|'random'}）；`getWindowInfo` 增返 `movement` 当前态（解决引擎初始推送早于页面加载的时序问题：renderer 先订阅再拉当前态）。
- preload 新增 `onMovementState(cb)`（返回退订函数）/ `setMovement(opts)`；类型手工同步。
- app.ts：`applyMovementState` 驱动 facing + 动画（walk/turn/idle）；**manualOverride 机制**：dev 面板点播动画/Dir 后优先手动，直到下个 phase 变化交还驱动权；HUD 增 `Move: EDGE/phase` 行。
- dev 面板控制行（Dir/Move/Mode 三钮）：Move 开关、Mode 循环切换 CW→CCW→Rand（T302/T303/T304 可人工验收）。

### 测试
- 新增 `tests/unit/movement.test.js` 11 条：pathRect/边序/终点角/朝向映射、**顺/逆时针闭环边序断言**、转角落位+停顿+恢复、**三种模式各连续模拟 5 分钟（18000 步）断言不越界/无瞬移（单步位移≤最大步长）/无 NaN**（T302/T303 验收）、random 换向不卡角（T304）、退化路径不死循环、F004 速度系数区间。全部 33/33 PASS（曾发现测试自身断言方向写反：引擎语义 rng<0.5→cw，已修测试）。
- `npm run lint` PASS；`npm run dev` 启动即见移动（初始 x=256 → 日志时已行至 248，BOTTOM 边向左）。

### 遗留/待办
- 人工确认：沿四边连续行走画圈、转角处播 turn 动画且窗口不跳变、四边朝向正确（竖边贴墙）、面板 Move/Mode 控制生效。
- 拖动/点击时暂停移动属 Phase 6（T601）；随机停顿/回巢属 Phase 4 状态机；多显示器工作区切换属 Phase 9（T902）。
- 当前速度固定 normal 75px/s，Slow/Fast 档位接入配置属 Phase 8（T801）。

---

## 补充：素材全量到位 + project_map.md —— ✅ 完成（2026-09-29，Phase 2 素材部分升级）

- **背景**：用户在工程内补齐了 DinoPet Final Asset Pack（`asset-manifest.json` + `README_ASSETS.md` + `CLAUDE_CODE_CODEX_QODER_MASTER_PROMPT.md`）：10 组动画全部为正式单帧 PNG，**主方向改为朝右**（旧切片素材朝左，idle/walk/run 已被覆盖替换）。
- **校验**：新增 `scripts/validate-assets.js`（按 asset-manifest.json 逐帧检查：数量/256×256/非空/四角透明），**75 帧全部 PASS**；目检 idle/walk/turn/fire/sleep 风格一致、fire 火焰源在口腔内。
- **代码同步**：`AnimationManifest.ts` —— `DINO_SOURCE_FACING='right'`；10 组全部 `placeholder:false`；frames/fps/loop 按素材清单更新（idle 6f@8、run 8f@14、turn 5f@10、fire/water 10f@12、tail 8f@10、jump 8f@12、sleep 6f@5 loop、reaction 8f@12）。删除 7 个 PLACEHOLDER.md。翻转逻辑无需改（isFlipped 基于 SOURCE_FACING 自动反转）。
- **测试同步**：asset-manifest.test.js 改为：10 组齐全/朝右声明/全正式素材/磁盘帧数连续/**与根 asset-manifest.json 一致性**；共 22/22 PASS，dev 日志 `sprites preloaded: 10 animations`。
- **新增文档**：`project_map.md`（全文件路径与关系索引：三进程依赖图/资产表/测试表/构建链/约定速查）。
- **待办**：`effects/{fire,water,dust,sparkle}` 未接入（Phase 5 按需，注意 README 禁止用其替代 fire/water 角色帧）；新增 7 组为简化画风（与 idle/walk/run 精修画风有差异），如后续替换精修版只需换 PNG+保持帧数，单测自动把关。

---

## Phase 2：Dino Renderer —— ✅ 完成（2026-09-29，待人工确认动画播放表现）

### 资产管线（T202）
> 注：本阶段自研切片产出的旧 idle(5)/walk/run（朝左）已被 Final Asset Pack（朝右 10 组）覆盖替换，见上方「补充」条目与 project_map.md；切片脚本保留为开发工具。
- **切片脚本** `scripts/extract-frames.js`（CommonJS + devDep `pngjs`，仅开发期用）：`node scripts/extract-frames.js <sheet.png> <outDir> <anim1,anim2,...>`。算法：全图连通域找行条带（w>1000）→ 条带内洪泛抠底色 → 角色级连通体（≥3000px）按 x 排序=帧 → 面积平均缩放到 256×256、脚底基线对齐 BASELINE_Y=248。
  - 踩坑记录：①素材页面背景是**透明像素（alpha≈0）**不是白色，背景判定用 alpha；②alpha 输出不能再乘 255（双重缩放溢出致全空帧）；③行内单元格底板相互接触，只能在条带级处理。
- **产物**：`assets/dino/idle/01-05.png`（5 帧）、`walk/01-08.png`（8 帧）、`run/01-08.png`（8 帧），透明底 256×256，目检合格；`assets/dino/character-sheet.png` = 方案2 母版参考图。
- **10 组动画结构**：全部为正式素材（见「补充」条目）；placeholder 目录与 PLACEHOLDER.md 已删除，placeholder 渲染路径仅作加载失败兜底。

### 动画模块（渲染侧分层，均为 ESM、import 带 .js 后缀）
- `src/renderer/animation/AnimationDefinition.ts`：`AnimationId` 联合类型 + `AnimationDefinition` 接口 + `validateManifest()` 纯函数。
- `src/renderer/animation/AnimationManifest.ts`：集中配置（帧数/FPS/loop/placeholder），`DINO_SOURCE_FACING='left'`（帧朝左，朝右=水平翻转，PRD §5.4 单方向素材）。**帧数与磁盘 PNG 数由单测强校验**。
- `src/renderer/animation/AnimationEngine.ts`（纯逻辑，零 DOM）：dt 累加器推进帧；loop 取模；非 loop 钳制最后一帧 + `onFinished` 只回调一次（Phase 5 技能收尾依赖）；`setAnimation` 同动画播放中幂等忽略、已结束则重播。
- `src/renderer/asset/SpriteSheet.ts`：一次性预加载全部帧并常驻；URL 规则 `../../assets/dino/<dir>/NN.png`（相对 index.html）；失败 → log + `ok=false`，渲染层回退占位。
- `src/renderer/render/DinoRenderer.ts`：DPR 适配（位图=CSS×dpr）、`drawFrame(img, flipped, fallbackLabel)`（scaleX(-1) 翻转）、`drawPlaceholder(label)`（程序恐龙+显式 `xxx placeholder` 字样，从 Phase 1 app.ts 迁入）。
- `src/renderer/core/GameLoop.ts`：rAF 驱动，dt 钳制上限 0.1s（防后台恢复瞬进）。
- `src/renderer/app.ts` 重写：装配以上模块；默认播 idle；HUD（Anim/Frame/FPS/Dir，值变化才写 DOM）；命中检测扩展为**恐龙区(滞回) OR 调试面板区**。

### dev 资产调试面板（03 接入文档第八阶段）
- dev 窗口加宽：`DEV_WINDOW_WIDTH=372 / DEV_WINDOW_HEIGHT=128`（仅 --dev；正式仍 128×128 小窗）。布局：#stage(128×128 左上)=宠物区，右侧 #debug-panel。
- 面板：10 个动画按钮（占位组带 `*`）+ Dir: Left/Right 翻转按钮；main.ts 加 dev 专属 `console-message` 转发，renderer 日志直接进终端（验证可见性）。
- CSP 追加 `img-src 'self' file:`（本地帧图）。

### 单测基建扩展
- 新增 `tsconfig.unittest.json`：把纯逻辑目录 `src/renderer/animation/**` 编成 CJS 到 `dist-unittest/`（已入 .gitignore），供 node --test require；`npm test` 脚本插入该编译步。
- 新增 `tests/unit/animation-engine.test.js`（4 条：loop 取模/非 loop 钳制+回调一次/setAnimation 幂等+重播/dt≤0 不推进；dt 用 `n/fps + 1e-4` 防浮点差 ε）、`tests/unit/asset-manifest.test.js`（6 条：validateManifest/≥10 组/朝左声明/磁盘帧数一致且 01..NN 连续/占位目录含 PLACEHOLDER.md/idle・walk・run 为 loop 正式素材）。

### 验证
- `npm run lint` PASS；`npm test` PASS **21/21**（+10 条 Phase 2 新测）；`npm run dev` 日志：`[RENDERER:info] [INFO] sprites preloaded: 3 animations`（idle/walk/run 全加载成功，CSP/file 路径通），窗口定位 (256,890) 正常。

### 遗留/待办
- 人工确认：窗口内 idle 循环播放、面板按钮切 walk/run、Dir 翻转正确（T201 验收 visually）。
- Electron 37 弃用警告：`console-message` 旧签名仍可用，未来升级需改 Event 对象形式（dev-only，不影响功能）。
- ~~7 组 placeholder 素材到位前~~ → 已到位（Final Asset Pack，见「补充」条目）。

---

## Phase 1：透明桌面宠物窗口 —— ✅ 完成（2026-09-29，待人工确认窗口表现）

### 窗口尺寸模型（后续阶段都依赖这组数）
- `DINO_RENDER_SIZE = 96`（素材规范 §8 允许 64~128，取中间值）；`EFFECT_MARGIN = 16`；**宠物窗口 = 128×128**（`PET_WINDOW_WIDTH/HEIGHT`），窗口只贴合恐龙+特效区（TECH_DESIGN §4.1，禁止全屏大窗）。
- 坐标一律 DIP，与 `workArea`/`setPosition` 同系；renderer 侧同名常量与 `src/shared/constants.ts` **手工同步**（app.ts 顶部注释已标注，sandbox+ESM 隔离所致）。

### T101 透明窗口
- 新模块 `src/main/window-manager.ts`：`createPetWindow()` —— frame:false / transparent:true / resizable:false / maximizable:false / fullscreenable:false / skipTaskbar:true / hasShadow:false / backgroundColor '#00000000' / show:false；`setAlwaysOnTop(true, 'screen-saver')`。
- `src/renderer/`：html+css 背景必须 `transparent !important`（否则黑底）；canvas 全尺寸铺窗，按 `devicePixelRatio` 缩放绘制（DPI 预备）。

### T102 窗口定位
- 新模块 `src/main/screen-manager.ts`：`getPrimaryWorkArea()`（Electron workArea 已扣任务栏）、`getInitialPosition()`（底边左侧 15% 处，脚底贴工作区底边）、`clampIntoWorkArea()`（供后续移动引擎复用）。
- 裁剪算法在**纯函数模块** `src/shared/geometry.ts`（不依赖 Electron，可直接 node --test）：`clampToWorkArea`（含窗口大于工作区、负坐标、副屏偏移 workArea 等边界）、`pointInRect`。几何单测 7 条全过。
- 实测日志：`pet window at (256, 890), workArea={0,0,1707,1019}` → 底边 890+128=1018 ≤ 1019，无裁剪无任务栏错位。

### T103 点击穿透
- 双模式：`PASSIVE`（`setIgnoreMouseEvents(true,{forward:true})`，桌面可正常点击且 renderer 仍收 mousemove）↔ `INTERACTIVE`（`setIgnoreMouseEvents(false)`，恐龙可接收鼠标）。
- 切换链路：renderer `mousemove` 命中检测（进入=96px 标准区，退出=112px 外扩滞回区防抖）→ `dinoAPI.setInteractive(bool)` → IPC `dino:set-interactive` → main 幂等判断后 `applyClickThrough()`。**只在状态变化时发 IPC**（SKILL §23 禁高频 IPC）；`document.mouseleave` 兜底恢复 PASSIVE。
- main 端 payload 校验（非 boolean 拒绝 + WARN 日志），无空 catch。
- 新增调试链路：`dinoAPI.getWindowInfo()` → dev 浮层显示 Mode/Win/WorkArea/DPR（SKILL §30，事件驱动更新，无轮询）。

### 占位素材（重要）
- 当前画布绘制的是**程序占位恐龙**（canvas 画的圆身+背刺+眼睛+腮红，画面右下角有 "placeholder" 字样），配色取自素材包规范 §2。正式 IP 素材 Phase 2 起接入 `assets/dino/`，届时整段 `drawPlaceholderDino()` 被 SpriteRenderer 替换。

### 验证
- `npm run lint` PASS；`npm test` PASS **11/11**（smoke 4 + geometry 7）；`npm run dev` 启动稳定，窗口定位日志正确。已清理 Phase 0 遗留 electron 进程（验收红线：无残留进程——退出时同样需确认）。
- DevTools 的 `Autofill.enable failed` 报错为 Electron/DevTools 已知噪音，与应用无关。

### 遗留/待办
- 人工确认：透明无黑底、桌面/IDE 可正常点击、鼠标悬停恐龙时 Mode 变 interactive、DPI 实测归入 Phase 9 (T903)。
- `window-all-closed → app.quit()` 仍成立；Phase 7 加 Tray 后需改为隐藏不退窗。

---

## Phase 0：项目初始化 —— ✅ 完成（2026-09-29）

### 完成内容（T001/T002/T003 全部达成）
- **T001 Git**：`git init -b main`；新增 `.gitignore`（忽略 node_modules/dist/out/release/coverage/OS 与编辑器文件）、`LICENSE`（MIT）、`README.md`（Requirements/Install/Scripts/Controls/Development 结构）。
- **T002 npm**：`package.json` 五脚本齐全：
  - `build` = `tsc -p tsconfig.json && tsc -p tsconfig.renderer.json`
  - `dev` = build + `electron . --dev`（`--dev` 时主进程开 detached DevTools）
  - `start` = build + `electron .`
  - `test` = build + `node --test "tests/unit/**/*.test.js"`
  - `lint` = 双配置 `--noEmit`
  - `main` 入口 = `dist/main/main.js`；`engines: node >= 20`。
- **T003 Electron 三进程骨架**：
  - `src/main/main.ts`：400×300 基础窗口，`show:false → ready-to-show` 防白闪；`ipcMain.handle('dino:ping')` 返回 `{pong, version, isDev}`；`window-all-closed → app.quit()`（Phase 7 加 Tray 后需改）。
  - `src/preload/preload.ts`：`contextBridge.exposeInMainWorld('dinoAPI', { ping })`，暴露面最小化；sandbox 下不 require 本地模块，通道名 `'dino:ping'` 与 main 端手工同步（有注释标注）。
  - `src/renderer/`：`index.html`（CSP：`default-src 'self'`，禁远程资源/脚本）+ `app.ts`（调 `dinoAPI.ping()` 显示「🦖 DinoPet 骨架就绪 / version / dev」，catch 中记录错误并给可见 fallback，无空 catch）+ `styles.css`（Phase 1 将改为透明背景）。
  - `src/shared/constants.ts`：`APP_NAME`、`BASE_WINDOW_WIDTH/HEIGHT`、`IPC_CHANNEL_PING` 集中管理。
  - `tests/unit/smoke.test.js`：3 条冒烟断言（常量导出/尺寸为正/通道名非空）。

### 安全配置（后续阶段不得回退）
`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`；renderer 访问主进程唯一入口 = `window.dinoAPI`。

### 验证结果
- `npm run lint` PASS（0 错误）；`npm test` PASS（3/3）；`npm start` 主进程日志 `[INFO] DinoPet started (dev=false, version=0.1.0)`，窗口正常出现，进程稳定无崩溃。

### 遗留/待办
- ~~阶段汇报时请求用户人工确认窗口内 IPC 链路文字~~ → Phase 1 运行正常，ping 链路持续可用，视为通过。
- Git 未做任何 commit（用户指示统一延后）。

---

<!-- 下一阶段完成后，在此行上方插入 "## Phase 1：..." 条目，并更新 §0 一览表 -->
