import { BaseProvider } from "../base";
import type {
  ProviderMeta,
  Capability,
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  StreamingTextResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from "../types";
import { saveMedia } from "../../utils/file";
import { ProviderError } from "../../utils/errors";

interface GoogleTextResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GoogleImageResponse {
  predictions?: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
}

export class GoogleProvider extends BaseProvider {
  readonly meta: ProviderMeta = {
    id: "google",
    name: "Google AI",
    version: "1.0.0",
    capabilities: ["text", "image", "video", "embedding"],
  };

  private get baseUrl(): string {
    return "https://generativelanguage.googleapis.com/v1beta";
  }

  async validateCredentials(): Promise<boolean> {
    this.ensureInitialized();
    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.config.apiKey}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  getModels(capability: Capability): string[] {
    const models: Record<Capability, string[]> = {
      text: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
      image: ["imagen-3.0-generate-001"],
      audio: [],
      video: ["veo-001"],
      embedding: ["text-embedding-004"],
    };
    return models[capability] ?? [];
  }

  async generateText(
    request: TextGenerationRequest
  ): Promise<TextGenerationResponse> {
    this.ensureInitialized();
    this.ensureCapability("text");

    const startTime = performance.now();
    const model = this.getModel("text", request.model);

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            ...(request.systemPrompt
              ? [{ role: "user", parts: [{ text: request.systemPrompt }] }]
              : []),
            { role: "user", parts: [{ text: request.prompt }] },
          ],
          generationConfig: {
            maxOutputTokens: request.maxTokens,
            temperature: request.temperature,
          },
        }),
      }
    );

    const data = (await response.json()) as GoogleTextResponse;

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new ProviderError(
        `Invalid response from Google API: ${JSON.stringify(data)}`,
        "google"
      );
    }

    const text = data.candidates[0]!.content!.parts![0]!.text!;
    const usage = data.usageMetadata;

    return {
      success: true,
      data: text,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount,
            completionTokens: usage.candidatesTokenCount,
            totalTokens: usage.totalTokenCount,
          }
        : undefined,
      meta: {
        model,
        provider: "google",
        duration: performance.now() - startTime,
      },
    };
  }

  async generateTextStream(
    request: TextGenerationRequest
  ): Promise<StreamingTextResponse> {
    this.ensureInitialized();
    this.ensureCapability("text");

    const model = this.getModel("text", request.model);

    const response = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          generationConfig: {
            maxOutputTokens: request.maxTokens,
            temperature: request.temperature,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new ProviderError(
        `API error: ${response.status} - ${error}`,
        "google",
        response.status
      );
    }

    const stream = this.parseGoogleSSEStream(response.body!);

    return {
      stream,
      meta: { model, provider: "google" },
    };
  }

  private async *parseGoogleSSEStream(
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
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) yield text;
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
    const model = this.getModel("image", request.model);

    // Google's Imagen API uses a different endpoint
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/models/${model}:predict?key=${this.config.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [{ prompt: request.prompt }],
          parameters: {
            sampleCount: request.n ?? 1,
          },
        }),
      }
    );

    const data = (await response.json()) as GoogleImageResponse;

    if (!data.predictions) {
      throw new ProviderError(
        `Invalid response from Google Imagen API: ${JSON.stringify(data)}`,
        "google"
      );
    }

    const results = await Promise.all(
      data.predictions.map(async (item, index: number) => {
        let filePath: string | undefined;

        if (request.outputPath) {
          const outputPath =
            data.predictions!.length > 1
              ? request.outputPath.replace(/(\.[^.]+)$/, `_${index}$1`)
              : request.outputPath;

            filePath = await saveMedia(item.bytesBase64Encoded, {
              directory: ".",
              filename: outputPath,
              type: "image",
              format: "png",
            });
          }

          return {
            base64: item.bytesBase64Encoded,
            filePath,
          };
        }
      )
    );

    return {
      success: true,
      data: results,
      meta: {
        model,
        provider: "google",
        duration: performance.now() - startTime,
      },
    };
  }

  async generateVideo(
    request: VideoGenerationRequest
  ): Promise<VideoGenerationResponse> {
    this.ensureInitialized();
    this.ensureCapability("video");

    // Note: Google's Veo API may have different requirements
    // This is a placeholder implementation
    throw new ProviderError(
      "Video generation with Google Veo is not yet fully implemented. Please check Google's API documentation for the latest endpoints.",
      "google"
    );
  }
}
