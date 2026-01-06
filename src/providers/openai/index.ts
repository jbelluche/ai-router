import { BaseProvider } from "../base";
import type {
  ProviderMeta,
  Capability,
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  AudioGenerationRequest,
  AudioGenerationResponse,
  StreamingTextResponse,
} from "../types";
import { saveMedia } from "../../utils/file";

interface OpenAIChatResponse {
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

interface OpenAIImageResponse {
  data: Array<{
    b64_json: string;
    revised_prompt?: string;
  }>;
}

export class OpenAIProvider extends BaseProvider {
  readonly meta: ProviderMeta = {
    id: "openai",
    name: "OpenAI",
    version: "1.0.0",
    capabilities: ["text", "image", "audio", "embedding"],
  };

  private readonly baseUrl = "https://api.openai.com/v1";

  async validateCredentials(): Promise<boolean> {
    this.ensureInitialized();
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getModels(capability: Capability): string[] {
    const models: Record<Capability, string[]> = {
      text: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
      image: ["dall-e-3", "dall-e-2"],
      audio: ["tts-1", "tts-1-hd", "whisper-1"],
      video: [],
      embedding: ["text-embedding-3-large", "text-embedding-3-small"],
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
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
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

    const data = (await response.json()) as OpenAIChatResponse;

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
        provider: "openai",
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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
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
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const stream = this.parseSSEStream(response.body!);

    return {
      stream,
      meta: { model, provider: "openai" },
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
    const model = this.getModel("image", request.model);

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/images/generations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: request.prompt,
          size: request.size ?? "1024x1024",
          quality: request.quality ?? "standard",
          style: request.style ?? "vivid",
          n: request.n ?? 1,
          response_format: "b64_json",
        }),
      }
    );

    const data = (await response.json()) as OpenAIImageResponse;

    const results = await Promise.all(
      data.data.map(async (item, index: number) => {
        let filePath: string | undefined;

        if (request.outputPath) {
          const outputPath =
            data.data.length > 1
              ? request.outputPath.replace(/(\.[^.]+)$/, `_${index}$1`)
              : request.outputPath;

            filePath = await saveMedia(item.b64_json, {
              directory: ".",
              filename: outputPath,
              type: "image",
              format: "png",
            });
          }

          return {
            base64: item.b64_json,
            revisedPrompt: item.revised_prompt,
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
        provider: "openai",
        duration: performance.now() - startTime,
      },
    };
  }

  async generateAudio(
    request: AudioGenerationRequest
  ): Promise<AudioGenerationResponse> {
    this.ensureInitialized();
    this.ensureCapability("audio");

    const startTime = performance.now();
    const model = this.config.models?.tts ?? "tts-1";
    const format = request.format ?? "mp3";

    const response = await this.fetchWithRetry(`${this.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: request.prompt,
        voice: request.voice ?? "alloy",
        response_format: format,
        speed: request.speed ?? 1.0,
      }),
    });

    const audioData = new Uint8Array(await response.arrayBuffer());

    const filePath = await saveMedia(audioData, {
      directory: request.outputPath ? "." : "./output",
      filename: request.outputPath,
      type: "audio",
      format,
    });

    return {
      success: true,
      data: {
        filePath,
        format,
      },
      meta: {
        model,
        provider: "openai",
        duration: performance.now() - startTime,
      },
    };
  }
}
