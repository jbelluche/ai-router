# ai-router

A CLI tool that routes requests to various AI models through a unified interface. Access OpenAI, Google, Anthropic, Meta, Mistral, and 100+ other models with a single tool.

## Installation

```bash
# Clone and install
git clone https://github.com/jbelluche/ai-router.git
cd ai-router
./install.sh
```

To uninstall:

```bash
./uninstall.sh
```

## Configuration

Initialize the config file:

```bash
ai-router config init
```

Set your API keys:

```bash
# OpenRouter (recommended - access to 100+ models with one key)
ai-router config set openrouter.apiKey sk-or-v1-xxxxx

# Or individual providers
ai-router config set openai.apiKey sk-xxxxx
ai-router config set google.apiKey xxxxx
```

Config is stored at `~/.config/ai-router/config.json`

## Usage

### Text Generation

```bash
# Using OpenRouter (access any model)
ai-router generate-text -p openrouter --prompt "Explain quantum computing"

# Specify a model
ai-router generate-text -p openrouter -m anthropic/claude-sonnet-4 --prompt "Write a haiku"
ai-router generate-text -p openrouter -m openai/gpt-5-mini --prompt "Hello world"
ai-router generate-text -p openrouter -m google/gemini-3-flash-preview --prompt "What is 2+2?"

# Stream the response
ai-router generate-text -p openrouter --prompt "Tell me a story" --stream

# JSON output (for programmatic use)
ai-router generate-text -p openrouter --prompt "Hello" --json

# Using OpenAI directly
ai-router generate-text -p openai --prompt "Hello world"
```

### Image Generation

```bash
# Generate with Gemini (via OpenRouter)
ai-router generate-image -p openrouter --prompt "A cute robot waving hello" -o robot.png

# Generate with DALL-E (via OpenAI)
ai-router generate-image -p openai --prompt "A sunset over mountains" -o sunset.png

# With options
ai-router generate-image -p openai --prompt "A logo" --size 1024x1024 --quality hd -o logo.png
```

### Audio Generation (TTS)

```bash
# Generate speech
ai-router generate-audio -p openai --prompt "Hello, welcome to our app" -o welcome.mp3

# With voice selection
ai-router generate-audio -p openai --prompt "Hello" --voice nova --format wav -o hello.wav
```

### Configuration Management

```bash
ai-router config init          # Create config file
ai-router config show          # Show current config
ai-router config set <k> <v>   # Set a value
ai-router config path          # Show config file path
```

### Provider Information

```bash
ai-router providers list       # List all providers
ai-router providers info openrouter  # Show provider details
```

## Available Models (via OpenRouter)

OpenRouter provides access to 100+ models including:

| Provider | Models |
|----------|--------|
| Anthropic | claude-sonnet-4, claude-4.5-haiku |
| OpenAI | gpt-5.1, gpt-5, gpt-5-mini |
| Google | gemini-3-pro-preview, gemini-3-flash-preview, gemini-2.5-flash |
| Meta | llama-3.1-405b, llama-3.1-70b |
| Mistral | mistral-large, mixtral-8x22b |
| DeepSeek | deepseek-chat, deepseek-coder |

See [OpenRouter Models](https://openrouter.ai/models) for the full list.

## Output Format

With `--json` flag, responses are structured:

```json
{
  "success": true,
  "data": "Response text here",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 50,
    "totalTokens": 60
  },
  "meta": {
    "model": "anthropic/claude-sonnet-4",
    "provider": "openrouter",
    "duration": 1234.56
  }
}
```

## Environment Variables

Instead of config file, you can use environment variables:

```bash
export OPENROUTER_API_KEY=sk-or-v1-xxxxx
export OPENAI_API_KEY=sk-xxxxx
export GOOGLE_API_KEY=xxxxx
```

## Development

```bash
# Run directly
bun ./index.ts --help

# Type check
bun run typecheck

# Run tests
bun test
```
