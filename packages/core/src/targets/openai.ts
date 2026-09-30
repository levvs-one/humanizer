import { defineSurface } from "./define"

export const OPENAI_SURFACES = [
  defineSurface({
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
  }),
  defineSurface({
    id: "chatgpt-user-prompt",
    provider: "openai",
    product: "ChatGPT",
    label: "Chat prompt",
    instructionRole: "user",
    characterLimit: { kind: "unknown" },
    tokenLimitNote: "No verified hard character limit is stored for a ChatGPT chat prompt.",
    source: {
      label: "OpenAI prompt engineering guidance",
      url: "https://help.openai.com/en/articles/10032626-prompt-engineering-best-practices-for-chatgpt",
      verifiedAt: "2026-09-30"
    }
  }),
  defineSurface({
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
  }),
  defineSurface({
    id: "openai-api-user",
    provider: "openai",
    product: "OpenAI API",
    label: "User prompt",
    instructionRole: "user",
    characterLimit: { kind: "unknown" },
    tokenLimitNote: "The usable budget depends on the selected model context window.",
    source: {
      label: "OpenAI API quickstart",
      url: "https://platform.openai.com/docs/quickstart/make-your-first-api-request",
      verifiedAt: "2026-09-30"
    }
  })
] as const
