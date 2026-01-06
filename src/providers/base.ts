import type {
  AIProvider,
  ProviderMeta,
  Capability,
} from "./types";
import type { ProviderConfig } from "../config/types";
import { ProviderError } from "../utils/errors";

export abstract class BaseProvider implements AIProvider {
  abstract readonly meta: ProviderMeta;
  protected config!: ProviderConfig;
  protected initialized = false;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  abstract validateCredentials(): Promise<boolean>;
  abstract getModels(capability: Capability): string[];

  supports(capability: Capability): boolean {
    return this.meta.capabilities.includes(capability);
  }

  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new ProviderError(
        `${this.meta.name} provider not initialized`,
        this.meta.id
      );
    }
  }

  protected ensureCapability(capability: Capability): void {
    if (!this.supports(capability)) {
      throw new ProviderError(
        `${this.meta.name} does not support ${capability} generation`,
        this.meta.id
      );
    }
  }

  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries?: number
  ): Promise<Response> {
    const maxRetries = retries ?? this.config.maxRetries ?? 3;
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(this.config.timeout ?? 60000),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new ProviderError(
            `API error: ${response.status} - ${error}`,
            this.meta.id,
            response.status
          );
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await Bun.sleep(1000 * (i + 1));
        }
      }
    }

    throw lastError ?? new ProviderError("Unknown error", this.meta.id);
  }

  protected getModel(capability: Capability, requestModel?: string): string {
    if (requestModel) return requestModel;

    const configModels = this.config.models;
    if (configModels) {
      const modelKey = capability === "embedding" ? "text" : capability;
      if (configModels[modelKey as keyof typeof configModels]) {
        return configModels[modelKey as keyof typeof configModels]!;
      }
    }

    const defaultModels = this.getModels(capability);
    if (defaultModels.length > 0) {
      return defaultModels[0]!;
    }

    throw new ProviderError(
      `No model available for ${capability}`,
      this.meta.id
    );
  }
}
