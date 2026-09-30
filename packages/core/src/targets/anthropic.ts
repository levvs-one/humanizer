import { defineSurface } from "./define"

export const ANTHROPIC_SURFACES = [
  defineSurface({
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
  })
] as const
