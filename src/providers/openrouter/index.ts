import { BaseProvider } from "../base";
import type {
  ProviderMeta,
  Capability,
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  StreamingTextResponse,
} from "../types";
import { ProviderError } from "../../utils/errors";
import { saveMedia } from "../../utils/file";

interface OpenRouterChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export class OpenRouterProvider extends BaseProvider {
  readonly meta: ProviderMeta = {
    id: "openrouter",
    name: "OpenRouter",
    version: "1.0.0",
    capabilities: ["text", "image"],
  };

  private readonly baseUrl = "https://openrouter.ai/api/v1";
  private cachedModels: OpenRouterModel[] | null = null;

  async validateCredentials(): Promise<boolean> {
    this.ensureInitialized();
    try {
      const response = await fetch(`${this.baseUrl}/auth/key`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getModels(capability: Capability): string[] {
    // Popular models available on OpenRouter
    const models: Record<Capability, string[]> = {
      text: [
        "anthropic/claude-sonnet-4",
        "anthropic/claude-4.5-haiku",
        "openai/gpt-5.1",
        "openai/gpt-5",
        "openai/gpt-5-mini",
        "google/gemini-3-pro-preview",
        "google/gemini-3-flash-preview",
        "google/gemini-2.5-flash",
        "meta-llama/llama-3.1-405b-instruct",
        "meta-llama/llama-3.1-70b-instruct",
        "mistralai/mistral-large",
        "deepseek/deepseek-chat",
      ],
      image: [
        "openai/dall-e-3",
        "google/gemini-2.5-flash-image",
        "stability/stable-diffusion-xl",
      ],
      audio: [],
      video: [],
      embedding: [
        "openai/text-embedding-3-large",
        "openai/text-embedding-3-small",
      ],
    };
    return models[capability] ?? [];
  }

  async listAvailableModels(): Promise<OpenRouterModel[]> {
    if (this.cachedModels) {
      return this.cachedModels;
    }

    const response = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
    });

    if (!response.ok) {
      throw new ProviderError(
        `Failed to fetch models: ${response.status}`,
        "openrouter",
        response.status
      );
    }

    const data = (await response.json()) as OpenRouterModelsResponse;
    this.cachedModels = data.data;
    return this.cachedModels;
  }

  async generateText(
    request: TextGenerationRequest
  ): Promise<TextGenerationResponse> {
    this.ensureInitialized();
    this.ensureCapability("text");

    const startTime = performance.now();
    const model = request.model ?? this.getModel("text", request.model);

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          "HTTP-Referer": "https://github.com/ai-router",
          "X-Title": "ai-router",
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(request.systemPrompt
              ? [{ role: "system", content: request.systemPrompt }]
              : []),
            { role: "user", content: request.prompt },
          ],
          max_tokens: request.maxTokens,
          temperature: request.temperature,
        }),
      }
    );

    const data = (await response.json()) as OpenRouterChatResponse;

    if (!data.choices?.[0]?.message?.content) {
      throw new ProviderError(
        `Invalid response from OpenRouter: ${JSON.stringify(data)}`,
        "openrouter"
      );
    }

    return {
      success: true,
      data: data.choices[0]!.message.content,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
      meta: {
        model,
        provider: "openrouter",
        duration: performance.now() - startTime,
      },
    };
  }

  async generateTextStream(
    request: TextGenerationRequest
  ): Promise<StreamingTextResponse> {
    this.ensureInitialized();
    this.ensureCapability("text");

    const model = request.model ?? this.getModel("text", request.model);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        "HTTP-Referer": "https://github.com/ai-router",
        "X-Title": "ai-router",
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(request.systemPrompt
            ? [{ role: "system", content: request.systemPrompt }]
            : []),
          { role: "user", content: request.prompt },
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ProviderError(
        `API error: ${response.status} - ${error}`,
        "openrouter",
        response.status
      );
    }

    const stream = this.parseSSEStream(response.body!);

    return {
      stream,
      meta: { model, provider: "openrouter" },
    };
  }

  private async *parseSSEStream(
    body: ReadableStream<Uint8Array>
  ): AsyncIterable<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async generateImage(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResponse> {
    this.ensureInitialized();
    this.ensureCapability("image");

    const startTime = performance.now();
    const model = request.model ?? "google/gemini-2.5-flash-image";

    // OpenRouter handles image generation through chat completions
    // The model returns images inline in the response
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          "HTTP-Referer": "https://github.com/ai-router",
          "X-Title": "ai-router",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: `Generate an image: ${request.prompt}`,
            },
          ],
        }),
      }
    );

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type: string; image_url?: { url: string } }>;
          images?: Array<{ type: string; image_url?: { url: string } }>;
        };
      }>;
    };

    if (!data.choices?.[0]?.message) {
      throw new ProviderError(
        `Invalid response from OpenRouter: ${JSON.stringify(data).slice(0, 500)}`,
        "openrouter"
      );
    }

    const message = data.choices[0]!.message!;
    const content = message.content;
    const images = message.images;
    const results: Array<{ base64?: string; url?: string; filePath?: string }> = [];

    // Handle images array (Gemini format)
    if (images && Array.isArray(images)) {
      for (const img of images) {
        if (img.image_url?.url) {
          const url = img.image_url.url;

          if (url.startsWith("data:image")) {
            const base64Data = url.split(",")[1]!;
            let filePath: string | undefined;

            if (request.outputPath) {
              filePath = await saveMedia(base64Data, {
                directory: ".",
                filename: request.outputPath,
                type: "image",
                format: "png",
              });
            }

            results.push({ base64: base64Data, filePath });
          } else {
            results.push({ url });
          }
        }
      }
    }

    // Handle content-based response formats
    if (results.length === 0 && content) {
      if (typeof content === "string") {
        // Check if it's a base64 image or URL in the text
        const base64Match = content.match(/data:image\/[^;]+;base64,([^"'\s]+)/);
        const urlMatch = content.match(/https?:\/\/[^\s"']+\.(png|jpg|jpeg|webp|gif)/i);

        if (base64Match) {
          const base64Data = base64Match[1]!;
          let filePath: string | undefined;

          if (request.outputPath) {
            filePath = await saveMedia(base64Data, {
              directory: ".",
              filename: request.outputPath,
              type: "image",
              format: "png",
            });
          }

          results.push({ base64: base64Data, filePath });
        } else if (urlMatch) {
          results.push({ url: urlMatch[0] });
        }
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === "image_url" && part.image_url?.url) {
            const url = part.image_url.url;

            if (url.startsWith("data:image")) {
              const base64Data = url.split(",")[1]!;
              let filePath: string | undefined;

              if (request.outputPath) {
                filePath = await saveMedia(base64Data, {
                  directory: ".",
                  filename: request.outputPath,
                  type: "image",
                  format: "png",
                });
              }

              results.push({ base64: base64Data, filePath });
            } else {
              results.push({ url });
            }
          }
        }
      }
    }

    if (results.length === 0) {
      throw new ProviderError(
        `No image found in response: ${JSON.stringify(data).slice(0, 500)}`,
        "openrouter"
      );
    }

    return {
      success: true,
      data: results,
      meta: {
        model,
        provider: "openrouter",
        duration: performance.now() - startTime,
      },
    };
  }
}
