import type { ProviderConfig } from "../config/types";

export type Capability = "text" | "image" | "audio" | "video" | "embedding";

export interface ProviderMeta {
  id: string;
  name: string;
  version: string;
  capabilities: Capability[];
}

export interface GenerationRequest {
  prompt: string;
  model?: string;
  options?: Record<string, unknown>;
}

export interface TextGenerationRequest extends GenerationRequest {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface ImageGenerationRequest extends GenerationRequest {
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "natural" | "vivid";
  n?: number;
  outputPath?: string;
}

export interface AudioGenerationRequest extends GenerationRequest {
  voice?: string;
  format?: "mp3" | "opus" | "aac" | "flac" | "wav";
  speed?: number;
  outputPath?: string;
}

export interface VideoGenerationRequest extends GenerationRequest {
  duration?: number;
  fps?: number;
  resolution?: string;
  outputPath?: string;
}

export interface UsageInfo {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ResponseMeta {
  model: string;
  provider: string;
  duration: number;
}

export interface GenerationResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: UsageInfo;
  meta?: ResponseMeta;
}

export interface TextGenerationResponse extends GenerationResponse<string> {
  data: string;
}

export interface ImageResult {
  url?: string;
  base64?: string;
  filePath?: string;
  revisedPrompt?: string;
}

export interface ImageGenerationResponse
  extends GenerationResponse<ImageResult[]> {
  data: ImageResult[];
}

export interface AudioResult {
  filePath: string;
  duration?: number;
  format: string;
}

export interface AudioGenerationResponse extends GenerationResponse<AudioResult> {
  data: AudioResult;
}

export interface VideoResult {
  filePath: string;
  duration?: number;
  format: string;
}

export interface VideoGenerationResponse extends GenerationResponse<VideoResult> {
  data: VideoResult;
}

export interface StreamingTextResponse {
  stream: AsyncIterable<string>;
  meta: {
    model: string;
    provider: string;
  };
}

export interface AIProvider {
  readonly meta: ProviderMeta;

  initialize(config: ProviderConfig): Promise<void>;
  validateCredentials(): Promise<boolean>;

  supports(capability: Capability): boolean;
  getModels(capability: Capability): string[];

  generateText?(request: TextGenerationRequest): Promise<TextGenerationResponse>;
  generateTextStream?(
    request: TextGenerationRequest
  ): Promise<StreamingTextResponse>;
  generateImage?(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResponse>;
  generateAudio?(
    request: AudioGenerationRequest
  ): Promise<AudioGenerationResponse>;
  generateVideo?(
    request: VideoGenerationRequest
  ): Promise<VideoGenerationResponse>;
}
