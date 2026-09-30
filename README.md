# DinoPet 🦖

> 轻量、可爱、不打扰工作的开源桌面恐龙宠物。

DinoPet 是一只住在桌面边缘的小恐龙：它会沿屏幕四边来回行走，随机触发吐火、吐水、摇尾巴、跳跃、睡觉等动作；你可以拖动它、点一下让它走过去，也可以双击让它跑开。默认**鼠标点击穿透**，不打扰你正常使用电脑。

## 特性

- 🚶 **沿屏幕四边自动移动**：顺时针 / 逆时针 / 随机三种模式，转角有动画过渡而非瞬移。
- 🎭 **随机行为**：吐火 / 吐水 / 摇尾巴 / 跳跃 / 发呆 / 睡觉，带概率权重与冷却，不会连续刷同一动作。
- 🖱️ **鼠标交互**：拖拽移动、单击走向目标点、双击跑开；恐龙本体区域可交互，其余区域点击穿透。
- 🧩 **系统托盘控制**：暂停 / 方向 / 速度 / 行为开关 / 设置 / 退出。
- ⚙️ **设置窗口**：方向、速度、行为、点击穿透、夜间模式、开机自启、目标显示器。
- 💾 **配置持久化**：所有偏好写入系统用户数据目录，重启后保留。
- 🖥️ **多显示器与 DPI**：可选目标显示器、显示器拔出自动迁移；支持 100%~175% DPI 缩放。
- 🌙 **夜间模式**：夜间时段（23:00–07:00）自动放慢移动。
- 🪶 **低资源占用**：状态变化才通信、特效播完即释放；单实例锁、渲染异常自动重载恢复。

## 环境要求

- Node.js 20+
- npm 9+
- Windows 10 / 11（V1 首要平台）

## 安装与运行

```
You can download DinoPet-Portable-1.2.0.exe in release package to directly execute the program.
```


```bash
git clone https://github.com/<your-username>/DinoPet.git
cd DinoPet
npm ci
npm start
```

启动后，小恐龙会出现在桌面底边并开始移动；系统托盘会出现 🦖 图标用于控制。

> 想关闭程序：右键托盘图标 → **Exit**（关闭窗口不会退出，恐龙常驻托盘）。

### 开发模式

```bash
npm run dev
```

开发模式会加宽窗口、在右侧显示**动画点播面板与调试 HUD**，并打开 DevTools，便于逐帧验收——**仅供开发**。日常想看到"只有一只恐龙"请用 `npm start`。

## 命令一览

| 命令 | 说明 |
|---|---|
| `npm start` | 编译并启动（正式模式，只显示恐龙） |
| `npm run dev` | 编译并以开发模式启动（含调试面板 / HUD / DevTools） |
| `npm run build` | TypeScript 构建到 `dist/` |
| `npm test` | 构建后运行单元 + 集成测试（`node --test`） |
| `npm run lint` | 双 `tsconfig` 类型检查 |

## 操作说明

**鼠标（悬停到恐龙身上时窗口才接收鼠标）**

| 操作 | 效果 |
|---|---|
| 拖动恐龙 | 移动它，松手后在落点继续巡逻 |
| 单击某处 | 恐龙沿屏幕边走到该点 |
| 双击 | 恐龙跑开到远处 |

**系统托盘 🦖**

- Pause / Resume：暂停 / 恢复自动移动（仍可手动拖动）
- Direction：顺时针 / 逆时针 / 随机
- Speed：慢 / 正常 / 快
- Behavior：开关随机行为（关闭后仅基态行走）
- Settings…：打开设置窗口
- Exit：退出程序

## 配置

配置以 JSON 持久化在系统用户数据目录（不会写入项目目录）：

- Windows：`%APPDATA%/DinoPet/config.json`

字段包含：`direction` / `speed` / `behaviorEnabled` / `clickThrough` / `nightMode` / `autoStart` / `monitorId`。设置窗口与托盘共用同一份配置并双向同步；损坏或非法的值会回落默认，不会导致启动崩溃。

## 技术栈

Electron + TypeScript（无渲染框架、无游戏引擎、无数据库、无后端）。三进程：

- **main**：窗口 / 屏幕 / 配置 / 托盘管理 + 移动引擎（主进程驱动窗口位置）+ IPC
- **preload**：最小 `window.dinoAPI` 桥（`contextIsolation` + `sandbox`，`nodeIntegration` 关闭，不加载任何远程资源）
- **renderer**：Canvas 逐帧动画 + 行为状态机 + 特效层

详见 `TECH_DESIGN.md`；进度与实现记录见 `project_process.md`；文件与模块索引见 `project_map.md`。

## 素材

角色动画帧来自 **DinoPet Final Asset Pack**（清单见 `asset-manifest.json` 与 `README_ASSETS.md`）：256×256 RGBA 透明底，主方向朝右（朝左由渲染镜像）。素材各自遵循 `README_ASSETS.md` 中声明的许可；本项目代码采用 MIT。

## 已知限制

- **开机自启**需在打包后的正式程序上验证（开发模式无副作用）。
- **多显示器迁移 / 拔出**需至少两台显示器才能实测（单显示器环境仅验证了 DPI 路径）。
- **Explorer（explorer.exe）重启**后托盘图标可能丢失，重新启动程序即可恢复。
- 长时间运行的内存表现建议在数小时的日常使用中观察。

## 路线图

V1 专注"一只稳定、可爱、不打扰的恐龙"。多恐龙、性格系统、角色包、Mod、社区、云等同步等放在后续版本，见 `TASK_LIST.md` 的 V1.1 / V2 / V3 Backlog。

## License

[MIT](LICENSE)
