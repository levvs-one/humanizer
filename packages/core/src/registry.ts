import type { PlanId, PromptSurface } from "./types"

export const SURFACES: readonly PromptSurface[] = [
  {
    id: "chatgpt-custom-instructions",
    provider: "openai",
    product: "ChatGPT",
    label: "Custom Instructions",
    instructionRole: "persistent",
    characterLimit: {
      kind: "by-plan",
      values: {
        free: 1500,
        go: 1500,
        plus: 5000,
        pro: 5000,
        business: 5000,
        enterprise: 5000,
        education: 5000
      }
    },
    source: {
      label: "OpenAI Help Center",
      url: "https://help.openai.com/en/articles/8096356-custom-instructions-for-chatgpt",
      verifiedAt: "2026-09-30"
    }
  },
  {
    id: "openai-api-developer",
    provider: "openai",
    product: "OpenAI API",
    label: "Developer instruction",
    instructionRole: "developer",
    characterLimit: { kind: "unknown" },
    tokenLimitNote: "The usable budget depends on the selected model context window.",
    source: {
      label: "OpenAI API documentation",
      url: "https://platform.openai.com/docs/guides/text",
      verifiedAt: "2026-09-30"
    }
  },
  {
    id: "anthropic-api-system",
    provider: "anthropic",
    product: "Claude API",
    label: "System prompt",
    instructionRole: "system",
    characterLimit: { kind: "unknown" },
    tokenLimitNote: "The usable budget depends on the selected Claude model context window.",
    source: {
      label: "Anthropic API documentation",
      url: "https://docs.anthropic.com/en/api/messages",
      verifiedAt: "2026-09-30"
    }
  },
  {
    id: "gemini-api-system",
    provider: "google",
    product: "Gemini API",
    label: "System instruction",
    instructionRole: "system",
    characterLimit: { kind: "unknown" },
    tokenLimitNote: "System instructions count toward input tokens; model limits vary.",
    source: {
      label: "Google AI for Developers",
      url: "https://ai.google.dev/gemini-api/docs/text-generation",
      verifiedAt: "2026-09-30"
    }
  }
] as const

export function getSurface(surfaceId: string): PromptSurface {
  const surface = SURFACES.find((entry) => entry.id === surfaceId)
  if (!surface) {
    throw new Error("Unknown prompt surface: " + surfaceId)
  }
  return surface
}

export function resolveCharacterLimit(surface: PromptSurface, plan?: PlanId): number | null {
  if (surface.characterLimit.kind === "fixed") {
    return surface.characterLimit.value
  }

  if (surface.characterLimit.kind === "by-plan") {
    if (!plan) {
      return null
    }
    return surface.characterLimit.values[plan] ?? null
  }

  return null
}
