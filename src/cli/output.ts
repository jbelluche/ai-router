import type { GenerationResponse } from "../providers/types";

export type OutputFormat = "json" | "text" | "pretty";

export function formatOutput(
  response: GenerationResponse,
  format: OutputFormat
): string {
  if (format === "json") {
    return JSON.stringify(response, null, 2);
  }

  if (format === "text") {
    if (!response.success) {
      return `Error: ${response.error}`;
    }
    if (typeof response.data === "string") {
      return response.data;
    }
    return JSON.stringify(response.data);
  }

  return formatPretty(response);
}

function formatPretty(response: GenerationResponse): string {
  const lines: string[] = [];

  if (response.success) {
    lines.push("\x1b[32m[SUCCESS]\x1b[0m");

    if (response.meta) {
      lines.push(`Provider: ${response.meta.provider}`);
      lines.push(`Model: ${response.meta.model}`);
      lines.push(`Duration: ${response.meta.duration.toFixed(0)}ms`);
    }

    if (response.usage) {
      const usage = response.usage;
      if (usage.totalTokens) {
        lines.push(
          `Tokens: ${usage.promptTokens ?? 0} prompt + ${usage.completionTokens ?? 0} completion = ${usage.totalTokens} total`
        );
      }
    }

    lines.push("---");

    if (typeof response.data === "string") {
      lines.push(response.data);
    } else if (Array.isArray(response.data)) {
      for (const item of response.data) {
        if (item.filePath) {
          lines.push(`File: ${item.filePath}`);
        }
        if (item.revisedPrompt) {
          lines.push(`Revised prompt: ${item.revisedPrompt}`);
        }
      }
    } else if (response.data && typeof response.data === "object") {
      const data = response.data as Record<string, unknown>;
      if (data.filePath) {
        lines.push(`File: ${data.filePath}`);
      }
    }
  } else {
    lines.push("\x1b[31m[ERROR]\x1b[0m");
    lines.push(response.error ?? "Unknown error");
  }

  return lines.join("\n");
}

export function formatError(error: Error, format: OutputFormat): string {
  const response: GenerationResponse = {
    success: false,
    error: error.message,
  };
  return formatOutput(response, format);
}

export async function streamOutput(
  stream: AsyncIterable<string>,
  format: OutputFormat
): Promise<void> {
  const writer = Bun.stdout.writer();

  if (format === "json") {
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const response: GenerationResponse<string> = {
      success: true,
      data: chunks.join(""),
    };
    writer.write(JSON.stringify(response, null, 2));
    writer.write("\n");
  } else {
    for await (const chunk of stream) {
      writer.write(chunk);
    }
    writer.write("\n");
  }

  await writer.flush();
}
