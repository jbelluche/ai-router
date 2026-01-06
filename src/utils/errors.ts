export class AIRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIRouterError";
  }
}

export class ProviderError extends AIRouterError {
  constructor(
    message: string,
    public readonly provider?: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class ConfigError extends AIRouterError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ValidationError extends AIRouterError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class CLIError extends AIRouterError {
  constructor(message: string) {
    super(message);
    this.name = "CLIError";
  }
}
