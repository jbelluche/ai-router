export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  organization?: string;
  projectId?: string;
  region?: string;
  models?: {
    text?: string;
    image?: string;
    audio?: string;
    tts?: string;
    video?: string;
  };
}

export interface OutputConfig {
  format: "json" | "text" | "pretty";
  directory: string;
  filenamePattern?: string;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  file?: string;
}

export interface CostConfig {
  maxCostPerQuery: number; // Maximum cost in USD per query (0 = unlimited)
  warnThreshold: number;   // Warn if cost exceeds this amount
}

export interface CachedModelPricing {
  input: number;   // per 1M tokens (converted from per-token)
  output: number;  // per 1M tokens
}

export interface PricingCache {
  lastUpdated: number;  // timestamp in ms
  ttlHours: number;     // cache TTL in hours
  models: Record<string, CachedModelPricing>;
}

export interface RouterConfig {
  version: string;
  defaultProvider: string;
  providers: {
    google?: ProviderConfig;
    openai?: ProviderConfig;
    openrouter?: ProviderConfig;
    [key: string]: ProviderConfig | undefined;
  };
  output: OutputConfig;
  logging?: LoggingConfig;
  cost?: CostConfig;
  pricing?: PricingCache;
}

export const DEFAULT_CONFIG: RouterConfig = {
  version: "1.0.0",
  defaultProvider: "openai",
  providers: {
    google: {
      apiKey: "${GOOGLE_API_KEY}",
      timeout: 60000,
      maxRetries: 3,
      models: {
        text: "gemini-1.5-pro",
        image: "imagen-3.0",
      },
    },
    openai: {
      apiKey: "${OPENAI_API_KEY}",
      timeout: 60000,
      maxRetries: 3,
      models: {
        text: "gpt-4o",
        image: "dall-e-3",
        tts: "tts-1-hd",
        audio: "whisper-1",
      },
    },
    openrouter: {
      apiKey: "${OPENROUTER_API_KEY}",
      timeout: 60000,
      maxRetries: 3,
      models: {
        text: "anthropic/claude-sonnet-4",
        image: "openai/dall-e-3",
      },
    },
  },
  output: {
    format: "json",
    directory: "./output",
    filenamePattern: "{type}_{timestamp}",
  },
  logging: {
    level: "info",
  },
  cost: {
    maxCostPerQuery: 0.10, // Default max $0.10 per query
    warnThreshold: 0.05,   // Warn if over $0.05
  },
};
