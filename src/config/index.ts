import { homedir } from "os";
import { join, dirname } from "path";
import type { RouterConfig, ProviderConfig } from "./types";
import { DEFAULT_CONFIG } from "./types";
import { ConfigError } from "../utils/errors";

const DEFAULT_CONFIG_PATH = join(
  homedir(),
  ".config",
  "ai-router",
  "config.json"
);

export function getConfigPath(): string {
  return process.env.AI_ROUTER_CONFIG ?? DEFAULT_CONFIG_PATH;
}

export async function loadConfig(path?: string): Promise<RouterConfig> {
  const configPath = path ?? getConfigPath();
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    return resolveEnvVars(DEFAULT_CONFIG);
  }

  try {
    const raw = await file.json();
    const merged = mergeWithDefaults(raw);
    return resolveEnvVars(merged);
  } catch (error) {
    throw new ConfigError(
      `Failed to parse config file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function mergeWithDefaults(config: Partial<RouterConfig>): RouterConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    providers: {
      ...DEFAULT_CONFIG.providers,
      ...config.providers,
    },
    output: {
      ...DEFAULT_CONFIG.output,
      ...config.output,
    },
  };
}

function resolveEnvVars(config: RouterConfig): RouterConfig {
  const json = JSON.stringify(config);
  const resolved = json.replace(/\$\{(\w+)\}/g, (_, key) => {
    return process.env[key] ?? "";
  });
  return JSON.parse(resolved);
}

export async function saveConfig(
  config: RouterConfig,
  path?: string
): Promise<void> {
  const configPath = path ?? getConfigPath();
  const dir = dirname(configPath);

  await Bun.$`mkdir -p ${dir}`.quiet();
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}

export async function initConfig(path?: string): Promise<string> {
  const configPath = path ?? getConfigPath();
  const file = Bun.file(configPath);

  if (await file.exists()) {
    throw new ConfigError(`Config file already exists at ${configPath}`);
  }

  await saveConfig(DEFAULT_CONFIG, configPath);
  return configPath;
}

export async function setConfigValue(
  keyPath: string,
  value: string,
  configPath?: string
): Promise<void> {
  const config = await loadConfig(configPath);
  const keys = keyPath.split(".");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = config;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }

  const finalKey = keys[keys.length - 1]!;
  current[finalKey] = value;

  await saveConfig(config, configPath);
}

export function getProviderConfig(
  config: RouterConfig,
  providerId: string
): ProviderConfig | undefined {
  return config.providers[providerId];
}
