import type { CLIOptions } from "../index";
import type { RouterConfig } from "../../config/types";
import type { OutputFormat } from "../output";
import type { ImageGenerationRequest } from "../../providers/types";
import { formatOutput } from "../output";
import { providerRegistry } from "../../providers";
import { getProviderConfig } from "../../config";
import { CLIError } from "../../utils/errors";

export async function handleGenerateImage(
  config: RouterConfig,
  options: CLIOptions,
  format: OutputFormat
): Promise<void> {
  if (!options.prompt) {
    throw new CLIError("--prompt is required for generate-image");
  }

  const providerId = options.provider ?? config.defaultProvider;
  const providerConfig = getProviderConfig(config, providerId);

  if (!providerConfig) {
    throw new CLIError(`Provider '${providerId}' not configured`);
  }

  const provider = await providerRegistry.getProvider(providerId, providerConfig);

  if (!provider.supports("image")) {
    throw new CLIError(`Provider '${providerId}' does not support image generation`);
  }

  if (!provider.generateImage) {
    throw new CLIError(`Provider '${providerId}' does not implement image generation`);
  }

  const request: ImageGenerationRequest = {
    prompt: options.prompt,
    model: options.model,
    outputPath: options.output,
    n: options.n ? parseInt(options.n, 10) : undefined,
  };

  if (options.size) {
    request.size = options.size as ImageGenerationRequest["size"];
  }

  if (options.quality) {
    request.quality = options.quality as ImageGenerationRequest["quality"];
  }

  if (options.style) {
    request.style = options.style as ImageGenerationRequest["style"];
  }

  const response = await provider.generateImage(request);
  console.log(formatOutput(response, format));
}
