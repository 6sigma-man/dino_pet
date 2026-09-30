/**
 * 配置持久化管理器（TECH_DESIGN §2 Config Manager / §19；PRD §15）。
 * 默认落盘：Electron app.getPath('userData')/config.json —— 禁止写入项目目录（§19）。
 * JSON 存储，不引入数据库（PRD §15 红线）。加载/写入均经 clampConfig 归一，坏配置回落默认不崩溃。
 * filePath 可选注入（集成测用临时目录）；缺省才访问 electron app，纯 Node 传 filePath 不触发。
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { clampConfig, DEFAULT_CONFIG, type DinoConfig } from '../shared/config-schema';

export interface ConfigManager {
  get(): DinoConfig;
  /** 合并 partial → 校验 → 落盘 → 通知订阅者；返回归一后的完整配置 */
  set(partial: Partial<DinoConfig>): DinoConfig;
  /** 订阅配置变化（set 成功后回调）；返回退订函数 */
  subscribe(cb: (cfg: DinoConfig) => void): () => void;
}

export function createConfigManager(filePath?: string): ConfigManager {
  const file = filePath ?? path.join(app.getPath('userData'), 'config.json');
  const listeners = new Set<(c: DinoConfig) => void>();

  function load(): DinoConfig {
    try {
      if (fs.existsSync(file)) {
        return clampConfig(JSON.parse(fs.readFileSync(file, 'utf-8')));
      }
    } catch (err) {
      console.warn(`[WARN] config load failed, using defaults: ${(err as Error).message}`);
    }
    return { ...DEFAULT_CONFIG };
  }

  let cfg: DinoConfig = load();

  function persist(): void {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[ERROR] config persist failed: ${(err as Error).message}`);
    }
  }

  return {
    get: () => cfg,
    set(partial: Partial<DinoConfig>): DinoConfig {
      cfg = clampConfig({ ...cfg, ...partial });
      persist();
      for (const cb of listeners) {
        cb(cfg);
      }
      return cfg;
    },
    subscribe(cb: (c: DinoConfig) => void): () => void {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
