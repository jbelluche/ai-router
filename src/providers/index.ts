import type { AIProvider, Capability } from "./types";
import type { ProviderConfig } from "../config/types";
import { ProviderError } from "../utils/errors";
import { OpenAIProvider } from "./openai";
import { GoogleProvider } from "./google";
import { OpenRouterProvider } from "./openrouter";

type ProviderFactory = () => AIProvider;

class ProviderRegistry {
  private providers = new Map<string, AIProvider>();
  private factories = new Map<string, ProviderFactory>();

  constructor() {
    this.registerFactory("openai", () => new OpenAIProvider());
    this.registerFactory("google", () => new GoogleProvider());
    this.registerFactory("openrouter", () => new OpenRouterProvider());
  }

  registerFactory(id: string, factory: ProviderFactory): void {
    this.factories.set(id, factory);
  }

  async getProvider(
    id: string,
    config?: ProviderConfig
  ): Promise<AIProvider> {
    const cached = this.providers.get(id);
    if (cached) {
      return cached;
    }

    const factory = this.factories.get(id);
    if (!factory) {
      throw new ProviderError(`Unknown provider: ${id}`, id);
    }

    const provider = factory();

    if (config) {
      await provider.initialize(config);
    }

    this.providers.set(id, provider);
    return provider;
  }

  listProviders(): string[] {
    return Array.from(this.factories.keys());
  }

  getProviderInfo(id: string): AIProvider["meta"] | undefined {
    const factory = this.factories.get(id);
    if (!factory) return undefined;

    const provider = factory();
    return provider.meta;
  }

  findProvidersForCapability(capability: Capability): string[] {
    const results: string[] = [];

    for (const [id, factory] of this.factories) {
      const provider = factory();
      if (provider.supports(capability)) {
        results.push(id);
      }
    }

    return results;
  }
}

export const providerRegistry = new ProviderRegistry();

export { OpenAIProvider } from "./openai";
export { GoogleProvider } from "./google";
export { OpenRouterProvider } from "./openrouter";
