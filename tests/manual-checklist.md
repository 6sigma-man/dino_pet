# DinoPet 测试计划（Phase 12）

> 三层：**Unit**（纯逻辑，`node --test` 自动）、**Integration**（Config 持久化自动 + Electron/IPC/Tray 人工）、**Manual**（全流程人工）。
> 运行：`npm run lint`；`npm test`（先 build，再跑 `tests/**/*.test.js`）。

## 1. Unit（自动化，`tests/unit/`）— 已覆盖 Phase 12 七项

| 要求项 | 落点 | 用例 |
|---|---|---|
| EdgePath | shared/movement | pathRect / nextEdge / edgeEnd |
| Direction | shared/movement | facingOn（顺/逆 + 朝右主方向语义）|
| Movement | shared/movement | 顺/逆闭环、转角不瞬移、5 分钟模拟不越界/无 NaN、随机换向、退化路径、speedFactor |
| BehaviorSelector | renderer/state | 概率闸门、累计权重抽样、多动作交替 |
| Cooldown | renderer/state | 冷却期内不重复、maxRepeat 上限 |
| StateMachine | renderer/state | 基态跟随、特殊动作、SLEEP、TURN 链、T601/602 交互 |
| Config | shared/config-schema | clampConfig 回落/归一、speedModeToPx、isNightHour |
| 资产一致性 | asset-manifest | AnimationManifest ↔ asset-manifest.json 帧数/FPS/loop |
| 动画/特效引擎 | renderer | AnimationEngine 取模/one-shot、EffectEngine done/prune |
| 几何 | shared/geometry | clampToWorkArea / pointInRect |

## 2. Integration

### 2.1 自动化（`tests/integration/`）
- **Config 持久化**（`config-persistence.test.js`）：set 落盘→新实例读回、坏 JSON 回落默认、非法值 clamp 归一后落盘、subscribe 通知与退订、目录递归创建。

### 2.2 人工（需 `npm start` 起真实 Electron）— 见 §3 勾选
- **Electron**：透明/无边框/置顶/skipTaskbar、点击穿透双模式、DPI。
- **IPC**：`dino:ping`、`dino:set-interactive`、`dino:get-window-info`、`dino:set-movement`、`dino:behavior`、`dino:get-config`/`set-config`/`config-changed`、`dino:get-displays` 全链路双向。
- **Tray**：Pause/Direction/Speed/Behavior/Settings/Exit 菜单项。

## 3. Manual 完整执行清单

启动后逐项验证（`npm start`，正式模式为宠物小窗；`npm run dev` 含调试面板）：

### 3.1 启动与窗口
- [ ] 10s 内恐龙出现在桌面底边，透明无黑底/矩形阴影
- [ ] 窗口不在任务栏（skipTaskbar）、覆盖普通窗口之上
- [ ] 桌面/浏览器/IDE 在恐龙以外区域可正常点击（PASSIVE 穿透）

### 3.2 行为流（TASK_LIST §Manual 主链）
- [ ] 行走：沿底边平移，脚贴边不越界
- [ ] 转角：到角停顿转向（turn 动画过渡，非瞬移），四边闭环
- [ ] 吐火：下颌开合、火焰起点在口腔内（§6 最高验收，无独立弹体）
- [ ] 吐水：同上，水柱自口内起喷
- [ ] 摇尾巴：tail 动画播放正常
- [ ] 发呆：idle 呼吸/静止
- [ ] 睡觉：sleep 循环 + zzz，唤醒后恢复移动
- [ ] 各动作间随机切换不卡死、冷却合理（不连续刷同一动作）

### 3.3 交互
- [ ] 拖动：按住恐龙拖动，窗口跟手；松手在落点继续巡逻
- [ ] 点击移动：单击某处恐龙走向目标点
- [ ] 点击穿透：悬停恐龙变 interactive 可拖，离开恢复 passive
- [ ] 双击：跑开到远处

### 3.4 托盘（T701/T702）
- [ ] Pause/Resume 冻结/恢复自动移动（拖动仍可用）
- [ ] Direction 顺/逆/随机 勾选即时生效且重启保留
- [ ] Speed 慢/正常/快 生效且重启保留
- [ ] Behavior 开关：关闭后仅基态行走、无随机动作
- [ ] Settings… 打开设置窗；改配置与托盘勾选双向同步
- [ ] Exit 真正退出、无残留进程

### 3.5 配置与持久化（T801/T802）
- [ ] 设置窗各项变更后 `%APPDATA%/DinoPet/config.json` 落盘
- [ ] 退出重启后配置还原（方向/速度/行为/穿透/夜间/自启/显示器）

### 3.6 系统能力（T901/T902/T903）
- [ ] 开机自启：勾选后打包版写入登录启动项（dev 无副作用）
- [ ] 多显示器：选择目标屏迁移；拖入副屏边界正确
- [ ] DPI 100/125/150/175% 不明显错位、不截断

### 3.7 异常（Phase 11）
- [ ] 显示器拔出：恐龙自动迁移主屏，不崩溃
- [ ] 分辨率变化：重定位不崩溃
- [ ] 全屏应用：恐龙浮于其上（预期），无崩溃
- [ ] Explorer 重启：不崩溃（托盘可能丢失，重启程序经单实例唤回）
- [ ] 程序重复启动：第二实例不产生新宠物，已有宠物唤到前台
- [ ] 渲染进程异常：自动重载恢复

### 3.8 性能（Phase 10，dev 看 `[PERF]` 或任务管理器）
- [ ] 连续 1 小时内存趋势平台化、无单调不回落增长
- [ ] 稳态 CPU 低占用、无每帧 IPC/日志
- [ ] 关闭后无残留进程
