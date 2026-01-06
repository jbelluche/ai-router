#!/usr/bin/env bun
import { parseCliArgs, printHelp, printVersion } from "./src/cli";
import type { OutputFormat } from "./src/cli/output";
import { formatError } from "./src/cli/output";
import { loadConfig } from "./src/config";
import { handleGenerateText } from "./src/cli/commands/generate-text";
import { handleGenerateImage } from "./src/cli/commands/generate-image";
import { handleGenerateAudio } from "./src/cli/commands/generate-audio";
import { handleGenerateVideo } from "./src/cli/commands/generate-video";
import { handleConfig } from "./src/cli/commands/config";
import { handleProviders } from "./src/cli/commands/providers";
import type { ConfigSubcommand, ProvidersSubcommand } from "./src/cli";

async function main() {
  const { command, subcommand, args, options } = parseCliArgs(Bun.argv);

  // Handle global flags
  if (options.version) {
    printVersion();
    return;
  }

  if (options.help || !command) {
    printHelp(command);
    return;
  }

  // Load config
  const config = await loadConfig();
  const format: OutputFormat = options.json ? "json" : config.output.format;

  try {
    switch (command) {
      case "generate-text":
        if (options.help) {
          printHelp("generate-text");
          return;
        }
        await handleGenerateText(config, options, format);
        break;

      case "generate-image":
        if (options.help) {
          printHelp("generate-image");
          return;
        }
        await handleGenerateImage(config, options, format);
        break;

      case "generate-audio":
        if (options.help) {
          printHelp("generate-audio");
          return;
        }
        await handleGenerateAudio(config, options, format);
        break;

      case "generate-video":
        if (options.help) {
          printHelp("generate-video");
          return;
        }
        await handleGenerateVideo(config, options, format);
        break;

      case "config":
        if (options.help) {
          printHelp("config");
          return;
        }
        await handleConfig(subcommand as ConfigSubcommand, args);
        break;

      case "providers":
        if (options.help) {
          printHelp("providers");
          return;
        }
        handleProviders(subcommand as ProvidersSubcommand, args);
        break;

      default:
        printHelp();
    }
  } catch (error) {
    const output = formatError(
      error instanceof Error ? error : new Error(String(error)),
      format
    );
    console.error(output);
    process.exit(1);
  }
}

main();
