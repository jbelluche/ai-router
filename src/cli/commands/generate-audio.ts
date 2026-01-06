import type { CLIOptions } from "../index";
import type { RouterConfig } from "../../config/types";
import type { OutputFormat } from "../output";
import type { AudioGenerationRequest } from "../../providers/types";
import { formatOutput } from "../output";
import { providerRegistry } from "../../providers";
import { getProviderConfig } from "../../config";
import { CLIError } from "../../utils/errors";

export async function handleGenerateAudio(
  config: RouterConfig,
  options: CLIOptions,
  format: OutputFormat
): Promise<void> {
  if (!options.prompt) {
    throw new CLIError("--prompt is required for generate-audio");
  }

  const providerId = options.provider ?? config.defaultProvider;
  const providerConfig = getProviderConfig(config, providerId);

  if (!providerConfig) {
    throw new CLIError(`Provider '${providerId}' not configured`);
  }

  const provider = await providerRegistry.getProvider(providerId, providerConfig);

  if (!provider.supports("audio")) {
    throw new CLIError(`Provider '${providerId}' does not support audio generation`);
  }

  if (!provider.generateAudio) {
    throw new CLIError(`Provider '${providerId}' does not implement audio generation`);
  }

  const request: AudioGenerationRequest = {
    prompt: options.prompt,
    outputPath: options.output,
    voice: options.voice,
    format: options.format as AudioGenerationRequest["format"],
  };

  const response = await provider.generateAudio(request);
  console.log(formatOutput(response, format));
}
