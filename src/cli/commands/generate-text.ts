import type { CLIOptions } from "../index";
import type { RouterConfig } from "../../config/types";
import type { OutputFormat } from "../output";
import { formatOutput, streamOutput } from "../output";
import { providerRegistry } from "../../providers";
import { getProviderConfig } from "../../config";
import { CLIError } from "../../utils/errors";

export async function handleGenerateText(
  config: RouterConfig,
  options: CLIOptions,
  format: OutputFormat
): Promise<void> {
  if (!options.prompt) {
    throw new CLIError("--prompt is required for generate-text");
  }

  const providerId = options.provider ?? config.defaultProvider;
  const providerConfig = getProviderConfig(config, providerId);

  if (!providerConfig) {
    throw new CLIError(`Provider '${providerId}' not configured`);
  }

  const provider = await providerRegistry.getProvider(providerId, providerConfig);

  if (!provider.supports("text")) {
    throw new CLIError(`Provider '${providerId}' does not support text generation`);
  }

  const request = {
    prompt: options.prompt,
    model: options.model,
    temperature: options.temperature ? parseFloat(options.temperature) : undefined,
    maxTokens: options.maxTokens ? parseInt(options.maxTokens, 10) : undefined,
    systemPrompt: options.systemPrompt,
    stream: options.stream,
  };

  if (options.stream && provider.generateTextStream) {
    const streamResponse = await provider.generateTextStream(request);
    await streamOutput(streamResponse.stream, format);
  } else if (provider.generateText) {
    const response = await provider.generateText(request);
    console.log(formatOutput(response, format));
  } else {
    throw new CLIError(`Provider '${providerId}' does not implement text generation`);
  }
}
