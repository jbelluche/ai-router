import type { RouterConfig, PricingCache, CachedModelPricing } from "../config/types";
import { loadConfig, saveConfig } from "../config";
import { getEncoding, type Tiktoken } from "js-tiktoken";

// Pricing per 1M tokens (in USD)
export interface ModelPricing {
  input: number;  // per 1M input tokens
  output: number; // per 1M output tokens
}

// Fallback pricing for unknown models (conservative estimate)
const DEFAULT_PRICING: ModelPricing = { input: 10, output: 30 };

// Default cache TTL: 24 hours
const DEFAULT_CACHE_TTL_HOURS = 24;

// Tiktoken encoder cache
let cl100kEncoder: Tiktoken | null = null;
let o200kEncoder: Tiktoken | null = null;

/**
 * Get the appropriate tiktoken encoder for a model
 * - OpenAI GPT-4o and newer: o200k_base
 * - OpenAI GPT-4, GPT-3.5: cl100k_base
 * - Other models: use cl100k_base as approximation
 */
function getEncoderForModel(model: string): Tiktoken {
  // GPT-4o and newer use o200k_base
  if (model.includes("gpt-4o") || model.includes("gpt-5") || model.includes("o1-") || model.includes("o3-")) {
    if (!o200kEncoder) {
      o200kEncoder = getEncoding("o200k_base");
    }
    return o200kEncoder;
  }

  // Everything else uses cl100k_base (good approximation for most models)
  if (!cl100kEncoder) {
    cl100kEncoder = getEncoding("cl100k_base");
  }
  return cl100kEncoder;
}

// OpenRouter API response types
interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;      // per-token cost as string
    completion: string;  // per-token cost as string
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

/**
 * Check if pricing cache is valid (not expired)
 */
export function isPricingCacheValid(cache: PricingCache | undefined): boolean {
  if (!cache || !cache.lastUpdated) return false;
  const ttlMs = (cache.ttlHours ?? DEFAULT_CACHE_TTL_HOURS) * 60 * 60 * 1000;
  return Date.now() - cache.lastUpdated < ttlMs;
}

/**
 * Get pricing for a model from cache
 */
export function getCachedPricing(
  config: RouterConfig,
  model: string
): ModelPricing | null {
  if (!config.pricing?.models?.[model]) return null;
  return config.pricing.models[model];
}

/**
 * Fetch pricing from OpenRouter API and update config cache
 */
export async function fetchAndCachePricing(apiKey: string): Promise<PricingCache> {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data = (await response.json()) as OpenRouterModelsResponse;

  // Convert per-token pricing to per-1M-token pricing
  const models: Record<string, CachedModelPricing> = {};
  for (const model of data.data) {
    const promptPrice = parseFloat(model.pricing.prompt) || 0;
    const completionPrice = parseFloat(model.pricing.completion) || 0;

    models[model.id] = {
      input: promptPrice * 1_000_000,
      output: completionPrice * 1_000_000,
    };
  }

  const cache: PricingCache = {
    lastUpdated: Date.now(),
    ttlHours: DEFAULT_CACHE_TTL_HOURS,
    models,
  };

  // Save to config
  const config = await loadConfig();
  config.pricing = cache;
  await saveConfig(config);

  return cache;
}

/**
 * Ensure pricing is available for a model, fetching if necessary
 */
export async function ensurePricingAvailable(
  config: RouterConfig,
  apiKey: string
): Promise<PricingCache> {
  // If cache is valid, return it
  if (isPricingCacheValid(config.pricing)) {
    return config.pricing!;
  }

  // Fetch fresh pricing
  return fetchAndCachePricing(apiKey);
}

/**
 * Get pricing for a model, using cache if available, otherwise default
 */
export function getModelPricing(
  model: string,
  cache?: PricingCache
): ModelPricing {
  // Check cache first
  if (cache?.models?.[model]) {
    return cache.models[model];
  }

  // Return conservative default for unknown models
  return DEFAULT_PRICING;
}

/**
 * Count tokens using tiktoken for accurate estimation
 * Uses the appropriate encoder based on the model
 */
export function estimateTokens(text: string, model?: string): number {
  try {
    const encoder = getEncoderForModel(model ?? "");
    return encoder.encode(text).length;
  } catch {
    // Fallback to rough estimate if tiktoken fails
    return Math.ceil(text.length / 4);
  }
}

export interface CostEstimate {
  model: string;
  inputTokens: number;
  estimatedOutputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  isEstimate: boolean;
}

export function estimateCost(
  model: string,
  prompt: string,
  systemPrompt?: string,
  expectedOutputTokens: number = 1000, // default estimate for output
  cache?: PricingCache
): CostEstimate {
  const pricing = getModelPricing(model, cache);
  const inputText = (systemPrompt ?? "") + prompt;
  const inputTokens = estimateTokens(inputText, model);

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (expectedOutputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  // isEstimate is true if we're using default pricing (model not in cache)
  const isEstimate = !cache?.models?.[model];

  return {
    model,
    inputTokens,
    estimatedOutputTokens: expectedOutputTokens,
    inputCost,
    outputCost,
    totalCost,
    isEstimate,
  };
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(4)}¢`;
  }
  return `$${cost.toFixed(4)}`;
}

export class CostLimitExceededError extends Error {
  constructor(
    public estimate: CostEstimate,
    public maxCost: number
  ) {
    super(
      `Estimated cost ${formatCost(estimate.totalCost)} exceeds max allowed ${formatCost(maxCost)} for model ${estimate.model}`
    );
    this.name = "CostLimitExceededError";
  }
}

export function checkCostLimit(estimate: CostEstimate, maxCost: number): void {
  if (maxCost > 0 && estimate.totalCost > maxCost) {
    throw new CostLimitExceededError(estimate, maxCost);
  }
}
