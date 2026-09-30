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
  }),
  defineSurface({
    id: "anthropic-api-user",
    provider: "anthropic",
    product: "Claude API",
    label: "User prompt",
    instructionRole: "user",
    characterLimit: { kind: "unknown" },
    tokenLimitNote: "The usable budget depends on the selected Claude model context window.",
    source: {
      label: "Anthropic prompting documentation",
      url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables",
      verifiedAt: "2026-09-30"
    }
  })
] as const
