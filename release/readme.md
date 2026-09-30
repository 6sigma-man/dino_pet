# DinoPet — Release

A small desktop dinosaur pet for Windows (Electron). It walks along the edges of your screen, does idle/skill animations, and can be controlled from the system tray.

---

## English

### Files in this folder

| File | What it is | When to use |
|---|---|---|
| `DinoPet-Portable-1.2.0.exe` | **Portable** app. No install, no admin. Just double-click. | Quickest way to run; copy it anywhere (USB, another PC). |
| `DinoPet-Setup-1.2.0.exe` | **Installer** (NSIS wizard). Lets you choose install folder, creates a desktop shortcut + Start Menu entry + uninstaller. | You want a normal installed app with shortcuts. |
| `win-unpacked\` | The raw unpacked app folder (`DinoPet.exe` + resources). | Inspection / advanced / running from a folder. |
| `DinoPet-Setup-1.2.0.exe.blockmap` | Delta-update metadata used by the installer. | Ignore it; ship it only if you use auto-update. |

> Portable and Setup run the **same program**. Both save your settings to `%APPDATA%\DinoPet\config.json` (survives restarts).

### How to use

1. Launch the app (double-click **Portable**, or run **Setup** then start the shortcut). The dino starts walking along the screen edges.
2. **System tray icon** (right-click the dino area / tray) menu:
   - **Pause / Resume**
   - **Direction**: Clockwise / Counterclockwise / Random
   - **Speed**: Slow / Normal / Fast
   - **Behavior**: Random behaviors (fire / sleep, …)
   - **Language**: English / 简体中文
   - **Settings…** / **Exit**
3. **Left-click anywhere on the desktop** → the dino walks in a straight line to that spot, then sprays water on arrival.
4. **Drag the dino** to reposition it; after releasing it may breathe fire.
5. **Settings…** window: same options plus **Click-through**, **Night mode**, **Auto-start on boot**, **Target display**, and **Interface language**.

Notes:
- This build is **unsigned**, so Windows SmartScreen may warn on first run → click **More info → Run anyway**.
- Multi-monitor: pick a target display in Settings; if it's unplugged the app falls back to the primary display.

### Version history

- **1.2.0** — Bilingual **tray + Settings window** (English / 简体中文). Language is selectable (tray "Language" submenu or the Settings dropdown) and both stay in sync. **Default is English**; your choice is saved.
- **1.1.0** — Point-and-walk: global left-click → walk straight to the click → spray water; drag → breathe fire. Custom app icon.
- **1.0.0** — Initial release: edge walking, skill animations, tray control, config persistence, multi-monitor handling, Windows packaging.

---

## 简体中文

一个 Windows 桌面上的小恐龙宠物（Electron 制作）。它会沿屏幕边缘行走、做待机/技能动画，并通过系统托盘控制。

### 本目录文件

| 文件 | 说明 | 适用场景 |
|---|---|---|
| `DinoPet-Portable-1.2.0.exe` | **便携版**，免安装、无需管理员权限，双击即用。 | 最快上手；可拷到任意位置（U 盘、别的电脑）。 |
| `DinoPet-Setup-1.2.0.exe` | **安装版**（NSIS 向导），可选安装目录，创建桌面/开始菜单快捷方式和卸载程序。 | 想要常规安装、带快捷方式。 |
| `win-unpacked\` | 解包后的原始程序目录（`DinoPet.exe` + 资源）。 | 查看 / 高级用法 / 直接从文件夹运行。 |
| `DinoPet-Setup-1.2.0.exe.blockmap` | 安装器使用的增量更新元数据。 | 可忽略；仅在启用自动更新时才需要随包发布。 |

> 便携版与安装版是**同一个程序**，设置都保存在 `%APPDATA%\DinoPet\config.json`（重启保留）。

### 使用方法

1. 启动程序（双击**便携版**，或先运行**安装版**再用快捷方式）。恐龙开始沿屏幕边缘行走。
2. **系统托盘菜单**：
   - **暂停 / 继续**
   - **方向**：顺时针 / 逆时针 / 随机
   - **速度**：慢 / 正常 / 快
   - **行为**：随机行为（喷火 / 睡觉 等）
   - **语言**：English / 简体中文
   - **设置…** / **退出**
3. **在桌面任意位置左键点击** → 恐龙沿直线走向点击处，到达后吐水。
4. **拖动恐龙**可改变位置；松手后它可能喷火。
5. **设置…** 窗口：除上述选项外，还有**点击穿透**、**夜间模式**、**开机自启**、**目标显示器**、**界面语言**。

提示：
- 本包**未做代码签名**，首次运行 Windows SmartScreen 可能告警 → 点**更多信息 → 仍要运行**。
- 多显示器：在设置里选目标显示器；拔掉该屏会自动回落到主屏。

### 版本历史

- **1.2.0** — **托盘 + 设置窗口**支持中英双语（English / 简体中文）。可切换语言（托盘"语言"子菜单或设置窗下拉），两侧实时同步。**默认英文**，选择会保存。
- **1.1.0** — 指路模式：全局左键 → 直线走向点击点 → 到达吐水；拖动 → 喷火。自定义应用图标。
- **1.0.0** — 首个版本：边缘行走、技能动画、托盘控制、配置持久化、多显示器处理、Windows 打包。
