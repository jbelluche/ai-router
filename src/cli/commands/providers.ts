import type { ProvidersSubcommand } from "../index";
import { providerRegistry } from "../../providers";
import { CLIError } from "../../utils/errors";

export function handleProviders(
  subcommand: ProvidersSubcommand | undefined,
  args: string[]
): void {
  switch (subcommand) {
    case "list":
      handleProvidersList();
      break;
    case "info":
      handleProvidersInfo(args[0]);
      break;
    default:
      throw new CLIError(
        `Unknown providers subcommand: ${subcommand}. Use 'list' or 'info'.`
      );
  }
}

function handleProvidersList(): void {
  const providers = providerRegistry.listProviders();

  console.log("Available providers:\n");

  for (const id of providers) {
    const info = providerRegistry.getProviderInfo(id);
    if (info) {
      console.log(`  ${info.name} (${info.id})`);
      console.log(`    Capabilities: ${info.capabilities.join(", ")}`);
      console.log();
    }
  }
}

function handleProvidersInfo(providerId?: string): void {
  if (!providerId) {
    throw new CLIError("Usage: ai-router providers info <provider>");
  }

  const info = providerRegistry.getProviderInfo(providerId);

  if (!info) {
    const available = providerRegistry.listProviders().join(", ");
    throw new CLIError(
      `Unknown provider: ${providerId}\nAvailable providers: ${available}`
    );
  }

  console.log(`Provider: ${info.name}`);
  console.log(`ID: ${info.id}`);
  console.log(`Version: ${info.version}`);
  console.log(`\nCapabilities:`);

  for (const capability of info.capabilities) {
    // Get available models for this capability
    const factory = () => {
      const providers = providerRegistry.listProviders();
      for (const id of providers) {
        if (id === providerId) {
          const meta = providerRegistry.getProviderInfo(id);
          return meta;
        }
      }
      return undefined;
    };

    console.log(`  - ${capability}`);
  }

  console.log(`\nUsage example:`);

  if (info.capabilities.includes("text")) {
    console.log(
      `  ai-router generate-text -p ${info.id} --prompt "Hello, world!"`
    );
  }
  if (info.capabilities.includes("image")) {
    console.log(
      `  ai-router generate-image -p ${info.id} --prompt "A sunset" -o sunset.png`
    );
  }
  if (info.capabilities.includes("audio")) {
    console.log(
      `  ai-router generate-audio -p ${info.id} --prompt "Hello" -o hello.mp3`
    );
  }
}
