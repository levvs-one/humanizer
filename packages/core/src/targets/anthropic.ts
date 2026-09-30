import { defineSurface } from "./define"

export const ANTHROPIC_SURFACES = [
  defineSurface({
    id: "claude-project-instructions",
    provider: "anthropic",
    product: "Claude",
    label: "Project Instructions",
    instructionRole: "persistent",
    characterLimit: { kind: "unknown" },
    tokenLimitNote: "Anthropic documents project instructions but does not publish a verified hard character limit here.",
    source: {
      label: "Anthropic Help Center",
      url: "https://support.anthropic.com/en/articles/9519177-how-can-i-create-and-manage-projects",
      verifiedAt: "2026-09-30"
    }
  }),
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
