import { parseArgs } from "util";

export interface CLIOptions {
  provider?: string;
  model?: string;
  prompt?: string;
  output?: string;
  stream?: boolean;
  json?: boolean;
  help?: boolean;
  version?: boolean;
  size?: string;
  quality?: string;
  style?: string;
  voice?: string;
  format?: string;
  temperature?: string;
  maxTokens?: string;
  systemPrompt?: string;
  n?: string;
  maxCost?: string;
  showCost?: boolean;
}

export type Command =
  | "generate-text"
  | "generate-image"
  | "generate-audio"
  | "generate-video"
  | "config"
  | "providers"
  | "help"
  | undefined;

export type ConfigSubcommand = "init" | "show" | "set" | "path" | "refresh-pricing";
export type ProvidersSubcommand = "list" | "info";

export interface ParsedCLI {
  command: Command;
  subcommand?: string;
  args: string[];
  options: CLIOptions;
}

export function parseCliArgs(args: string[]): ParsedCLI {
  const { values, positionals } = parseArgs({
    args: args.slice(2), // Skip bun path and script path
    options: {
      provider: { type: "string", short: "p" },
      model: { type: "string", short: "m" },
      prompt: { type: "string" },
      output: { type: "string", short: "o" },
      stream: { type: "boolean", short: "s" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      size: { type: "string" },
      quality: { type: "string" },
      style: { type: "string" },
      voice: { type: "string" },
      format: { type: "string" },
      temperature: { type: "string" },
      "max-tokens": { type: "string" },
      "system-prompt": { type: "string" },
      n: { type: "string" },
      "max-cost": { type: "string" },
      "show-cost": { type: "boolean" },
    },
    allowPositionals: true,
    strict: false,
  });

  const command = positionals[0] as Command;
  const subcommand = positionals[1];
  const restArgs = positionals.slice(2);

  return {
    command,
    subcommand,
    args: restArgs,
    options: {
      ...values,
      maxTokens: values["max-tokens"] as string | undefined,
      systemPrompt: values["system-prompt"] as string | undefined,
      maxCost: values["max-cost"] as string | undefined,
      showCost: values["show-cost"] as boolean | undefined,
    } as CLIOptions,
  };
}

export function printHelp(command?: Command): void {
  if (command === "generate-text") {
    console.log(`
ai-router generate-text - Generate text using an AI model

USAGE:
  ai-router generate-text --prompt "your prompt" [OPTIONS]

OPTIONS:
  -p, --provider <name>    Provider to use (openai, google) [default: from config]
  -m, --model <name>       Model to use [default: from config]
      --prompt <text>      The prompt to send (required)
      --system-prompt      System prompt for context
      --temperature <n>    Temperature (0-2) [default: 1]
      --max-tokens <n>     Maximum tokens to generate
  -s, --stream             Stream the response
      --json               Output in JSON format
      --max-cost <amount>  Maximum cost in USD (e.g., 0.10) [default: from config]
      --show-cost          Show cost estimate before/after request
  -h, --help               Show this help

EXAMPLES:
  ai-router generate-text --prompt "Write a haiku about coding"
  ai-router generate-text -p openai --prompt "Explain quantum computing" --stream
  ai-router generate-text --prompt "Hello" --max-cost 0.05 --show-cost
`);
  } else if (command === "generate-image") {
    console.log(`
ai-router generate-image - Generate images using an AI model

USAGE:
  ai-router generate-image --prompt "your prompt" [OPTIONS]

OPTIONS:
  -p, --provider <name>    Provider to use (openai, google) [default: from config]
  -m, --model <name>       Model to use [default: from config]
      --prompt <text>      The prompt to send (required)
  -o, --output <path>      Output file path
      --size <size>        Image size (256x256, 512x512, 1024x1024, etc.)
      --quality <q>        Quality (standard, hd) [OpenAI only]
      --style <s>          Style (natural, vivid) [OpenAI only]
  -n <count>               Number of images to generate
      --json               Output in JSON format
  -h, --help               Show this help

EXAMPLES:
  ai-router generate-image --prompt "A cat in space" -o ./cat.png
  ai-router generate-image -p openai --prompt "Sunset" --size 1024x1024 --quality hd
`);
  } else if (command === "generate-audio") {
    console.log(`
ai-router generate-audio - Generate audio (text-to-speech) using an AI model

USAGE:
  ai-router generate-audio --prompt "text to speak" [OPTIONS]

OPTIONS:
  -p, --provider <name>    Provider to use (openai) [default: from config]
      --prompt <text>      The text to convert to speech (required)
  -o, --output <path>      Output file path
      --voice <name>       Voice to use (alloy, echo, fable, onyx, nova, shimmer)
      --format <fmt>       Audio format (mp3, opus, aac, flac, wav) [default: mp3]
      --json               Output in JSON format
  -h, --help               Show this help

EXAMPLES:
  ai-router generate-audio --prompt "Hello, world!" -o ./hello.mp3
  ai-router generate-audio --prompt "Welcome" --voice nova --format wav
`);
  } else if (command === "generate-video") {
    console.log(`
ai-router generate-video - Generate video using an AI model

USAGE:
  ai-router generate-video --prompt "your prompt" [OPTIONS]

OPTIONS:
  -p, --provider <name>    Provider to use (google) [default: from config]
      --prompt <text>      The prompt to send (required)
  -o, --output <path>      Output file path
      --json               Output in JSON format
  -h, --help               Show this help

NOTE: Video generation support varies by provider and may require additional setup.
`);
  } else if (command === "config") {
    console.log(`
ai-router config - Manage configuration

USAGE:
  ai-router config <subcommand>

SUBCOMMANDS:
  init              Create a new config file with defaults
  show              Display current configuration
  set <key> <val>   Set a configuration value
  path              Show config file path
  refresh-pricing   Fetch and cache model pricing from OpenRouter

EXAMPLES:
  ai-router config init
  ai-router config set openai.apiKey sk-xxx
  ai-router config set defaultProvider google
  ai-router config show
  ai-router config refresh-pricing
`);
  } else if (command === "providers") {
    console.log(`
ai-router providers - List and inspect available providers

USAGE:
  ai-router providers <subcommand>

SUBCOMMANDS:
  list              List all available providers
  info <provider>   Show details about a specific provider

EXAMPLES:
  ai-router providers list
  ai-router providers info openai
`);
  } else {
    console.log(`
ai-router - Route requests to various AI models

USAGE:
  ai-router <command> [OPTIONS]

COMMANDS:
  generate-text     Generate text using an AI model
  generate-image    Generate images using an AI model
  generate-audio    Generate audio (TTS) using an AI model
  generate-video    Generate video using an AI model
  config            Manage configuration
  providers         List and inspect providers

GLOBAL OPTIONS:
  -h, --help        Show help for a command
  -v, --version     Show version number

EXAMPLES:
  ai-router generate-text --prompt "Hello, world!"
  ai-router generate-image -p openai --prompt "A sunset" -o ./sunset.png
  ai-router config init

Run 'ai-router <command> --help' for more information on a command.
`);
  }
}

export function printVersion(): void {
  console.log("ai-router v1.0.0");
}
