import type { CLIOptions } from "../index";
import type { RouterConfig, PricingCache } from "../../config/types";
import type { OutputFormat } from "../output";
import { formatOutput, streamOutput } from "../output";
import { providerRegistry } from "../../providers";
import { getProviderConfig } from "../../config";
import { CLIError } from "../../utils/errors";
import {
  estimateCost,
  checkCostLimit,
  formatCost,
  CostLimitExceededError,
  ensurePricingAvailable,
  getModelPricing,
} from "../../utils/pricing";

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

  // Determine the model that will be used
  const model = options.model ?? providerConfig.models?.text ?? provider.getModels("text")[0] ?? "unknown";
  const fullModel = providerId === "openrouter" && !model.includes("/") ? model :
                    providerId === "openrouter" ? model : `${providerId}/${model}`;

  const maxTokens = options.maxTokens ? parseInt(options.maxTokens, 10) : 1000;

  // Only check costs if --max-cost is specified
  let pricingCache: PricingCache | undefined;
  if (options.maxCost) {
    const maxCost = parseFloat(options.maxCost);

    // Fetch pricing if not cached (requires OpenRouter API key)
    const openrouterConfig = getProviderConfig(config, "openrouter");
    if (!openrouterConfig?.apiKey) {
      throw new CLIError(
        "Cost checking requires OpenRouter API key to fetch pricing.\n" +
        "Set it with: ai-router config set openrouter.apiKey <key>"
      );
    }

    try {
      console.error("Fetching model pricing...");
      pricingCache = await ensurePricingAvailable(config, openrouterConfig.apiKey);
      console.error(`Pricing cached for ${Object.keys(pricingCache.models).length} models.`);
    } catch (err) {
      throw new CLIError(`Failed to fetch pricing: ${err instanceof Error ? err.message : err}`);
    }

    // Estimate cost with cached pricing
    const costEstimate = estimateCost(
      fullModel,
      options.prompt,
      options.systemPrompt,
      maxTokens,
      pricingCache
    );

    // Show cost estimate
    if (options.showCost) {
      console.error(`\nCost estimate for ${fullModel}:`);
      console.error(`  Input: ~${costEstimate.inputTokens} tokens (${formatCost(costEstimate.inputCost)})`);
      console.error(`  Output: ~${costEstimate.estimatedOutputTokens} tokens (${formatCost(costEstimate.outputCost)})`);
      console.error(`  Total: ${formatCost(costEstimate.totalCost)}${costEstimate.isEstimate ? " (using default pricing)" : ""}`);
      console.error(`  Max allowed: ${formatCost(maxCost)}`);
      console.error("");
    }

    // Check cost limit
    try {
      checkCostLimit(costEstimate, maxCost);
    } catch (err) {
      if (err instanceof CostLimitExceededError) {
        throw new CLIError(
          `Cost limit exceeded: estimated ${formatCost(err.estimate.totalCost)} > max ${formatCost(err.maxCost)}\n` +
          `Increase --max-cost to allow this request.`
        );
      }
      throw err;
    }
  }

  const request = {
    prompt: options.prompt,
    model: options.model,
    temperature: options.temperature ? parseFloat(options.temperature) : undefined,
    maxTokens: maxTokens,
    systemPrompt: options.systemPrompt,
    stream: options.stream,
  };

  if (options.stream && provider.generateTextStream) {
    const streamResponse = await provider.generateTextStream(request);
    await streamOutput(streamResponse.stream, format);
  } else if (provider.generateText) {
    const response = await provider.generateText(request);

    // Show actual cost if requested and we have pricing
    if (options.showCost && response.usage && pricingCache) {
      const pricing = getModelPricing(fullModel, pricingCache);
      const actualInputCost = ((response.usage.promptTokens ?? 0) / 1_000_000) * pricing.input;
      const actualOutputCost = ((response.usage.completionTokens ?? 0) / 1_000_000) * pricing.output;
      console.error(`\nActual usage:`);
      console.error(`  Input: ${response.usage.promptTokens} tokens (${formatCost(actualInputCost)})`);
      console.error(`  Output: ${response.usage.completionTokens} tokens (${formatCost(actualOutputCost)})`);
      console.error(`  Total: ${formatCost(actualInputCost + actualOutputCost)}`);
    }

    console.log(formatOutput(response, format));
  } else {
    throw new CLIError(`Provider '${providerId}' does not implement text generation`);
  }
}
