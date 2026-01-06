import type { CLIOptions } from "../index";
import type { RouterConfig } from "../../config/types";
import type { OutputFormat } from "../output";
import type { VideoGenerationRequest } from "../../providers/types";
import { formatOutput } from "../output";
import { providerRegistry } from "../../providers";
import { getProviderConfig } from "../../config";
import { CLIError } from "../../utils/errors";

export async function handleGenerateVideo(
  config: RouterConfig,
  options: CLIOptions,
  format: OutputFormat
): Promise<void> {
  if (!options.prompt) {
    throw new CLIError("--prompt is required for generate-video");
  }

  const providerId = options.provider ?? config.defaultProvider;
  const providerConfig = getProviderConfig(config, providerId);

  if (!providerConfig) {
    throw new CLIError(`Provider '${providerId}' not configured`);
  }

  const provider = await providerRegistry.getProvider(providerId, providerConfig);

  if (!provider.supports("video")) {
    throw new CLIError(`Provider '${providerId}' does not support video generation`);
  }

  if (!provider.generateVideo) {
    throw new CLIError(`Provider '${providerId}' does not implement video generation`);
  }

  const request: VideoGenerationRequest = {
    prompt: options.prompt,
    outputPath: options.output,
  };

  const response = await provider.generateVideo(request);
  console.log(formatOutput(response, format));
}
