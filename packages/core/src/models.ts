import type { ModelDefinition } from "./types"

export const MODELS: readonly ModelDefinition[] = [
  {
    id: "gpt-5.6-sol",
    provider: "openai",
    label: "GPT-5.6 Sol",
    contextWindowTokens: 1_050_000,
    maxOutputTokens: 128_000,
    source: {
      label: "OpenAI model documentation",
      url: "https://platform.openai.com/docs/models",
      verifiedAt: "2026-09-30"
    }
  },
  {
    id: "gpt-5.6-terra",
    provider: "openai",
    label: "GPT-5.6 Terra",
    contextWindowTokens: 1_050_000,
    maxOutputTokens: 128_000,
    source: {
      label: "OpenAI model documentation",
      url: "https://platform.openai.com/docs/models",
      verifiedAt: "2026-09-30"
    }
  },
  {
    id: "gpt-5.6-luna",
    provider: "openai",
    label: "GPT-5.6 Luna",
    contextWindowTokens: 1_050_000,
    maxOutputTokens: 128_000,
    source: {
      label: "OpenAI model documentation",
      url: "https://platform.openai.com/docs/models",
      verifiedAt: "2026-09-30"
    }
  },
  {
    id: "claude-opus-5",
    provider: "anthropic",
    label: "Claude Opus 5",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    source: {
      label: "Claude model documentation",
      url: "https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4",
      verifiedAt: "2026-09-30"
    }
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    label: "Claude Sonnet 5",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    source: {
      label: "Claude model documentation",
      url: "https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4",
      verifiedAt: "2026-09-30"
    }
  },
  {
    id: "gemini-3.8-flash",
    provider: "google",
    label: "Gemini 3.8 Flash",
    contextWindowTokens: null,
    maxOutputTokens: null,
    source: {
      label: "Gemini model documentation",
      url: "https://ai.google.dev/gemini-api/docs/models",
      verifiedAt: "2026-09-30"
    }
  },
  {
    id: "gemini-3.5-flash",
    provider: "google",
    label: "Gemini 3.5 Flash",
    contextWindowTokens: 1_048_576,
    maxOutputTokens: 65_536,
    source: {
      label: "Gemini 3.5 Flash documentation",
      url: "https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash",
      verifiedAt: "2026-09-30"
    }
  }
] as const

export function getModel(modelId: string): ModelDefinition {
  const model = MODELS.find((entry) => entry.id === modelId)

  if (!model) {
    throw new Error("Unknown model: " + modelId)
  }

  return model
}

export function getModelsForProvider(provider: ModelDefinition["provider"]): readonly ModelDefinition[] {
  return MODELS.filter((model) => model.provider === provider)
}
