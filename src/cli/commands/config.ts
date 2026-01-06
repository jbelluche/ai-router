import type { ConfigSubcommand } from "../index";
import {
  loadConfig,
  saveConfig,
  initConfig,
  setConfigValue,
  getConfigPath,
} from "../../config";
import { CLIError, ConfigError } from "../../utils/errors";

export async function handleConfig(
  subcommand: ConfigSubcommand | undefined,
  args: string[]
): Promise<void> {
  switch (subcommand) {
    case "init":
      await handleConfigInit();
      break;
    case "show":
      await handleConfigShow();
      break;
    case "set":
      await handleConfigSet(args);
      break;
    case "path":
      handleConfigPath();
      break;
    default:
      throw new CLIError(
        `Unknown config subcommand: ${subcommand}. Use 'init', 'show', 'set', or 'path'.`
      );
  }
}

async function handleConfigInit(): Promise<void> {
  try {
    const path = await initConfig();
    console.log(`Config file created at: ${path}`);
    console.log("\nNext steps:");
    console.log("1. Set your API keys:");
    console.log("   ai-router config set openai.apiKey <your-key>");
    console.log("   ai-router config set google.apiKey <your-key>");
    console.log("\n2. Or set environment variables:");
    console.log("   export OPENAI_API_KEY=<your-key>");
    console.log("   export GOOGLE_API_KEY=<your-key>");
  } catch (error) {
    if (error instanceof ConfigError) {
      console.log(error.message);
      console.log("\nTo view current config: ai-router config show");
      console.log("To modify config: ai-router config set <key> <value>");
    } else {
      throw error;
    }
  }
}

async function handleConfigShow(): Promise<void> {
  const config = await loadConfig();

  // Mask API keys for display
  const displayConfig = JSON.parse(JSON.stringify(config));

  for (const [providerId, providerConfig] of Object.entries(
    displayConfig.providers
  )) {
    if (providerConfig && typeof providerConfig === "object") {
      const pc = providerConfig as { apiKey?: string };
      if (pc.apiKey && !pc.apiKey.startsWith("${")) {
        pc.apiKey = pc.apiKey.slice(0, 8) + "..." + pc.apiKey.slice(-4);
      }
    }
  }

  console.log("Config file:", getConfigPath());
  console.log("\nCurrent configuration:");
  console.log(JSON.stringify(displayConfig, null, 2));
}

async function handleConfigSet(args: string[]): Promise<void> {
  if (args.length < 2) {
    throw new CLIError(
      "Usage: ai-router config set <key> <value>\n\nExamples:\n  ai-router config set openai.apiKey sk-xxx\n  ai-router config set defaultProvider google"
    );
  }

  let [keyPath, ...valueParts] = args;
  const value = valueParts.join(" ");

  // Map provider shorthand paths to full paths
  // e.g., "openai.apiKey" -> "providers.openai.apiKey"
  const providerNames = ["openai", "google", "openrouter"];
  const firstPart = keyPath!.split(".")[0];
  if (providerNames.includes(firstPart!) && !keyPath!.startsWith("providers.")) {
    keyPath = `providers.${keyPath}`;
  }

  await setConfigValue(keyPath!, value);
  console.log(`Set ${keyPath} = ${value.startsWith("sk-") ? value.slice(0, 8) + "..." : value}`);
}

function handleConfigPath(): void {
  console.log(getConfigPath());
}
