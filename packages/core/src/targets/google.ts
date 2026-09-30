import { defineSurface } from "./define"

export const GOOGLE_SURFACES = [
  defineSurface({
    id: "gemini-gem-instructions",
    provider: "google",
    product: "Gemini",
    label: "Gem Instructions",
    instructionRole: "persistent",
    characterLimit: { kind: "unknown" },
    tokenLimitNote: "Google documents Gem instructions but does not publish a verified hard character limit here.",
    source: {
      label: "Gemini Apps Help",
      url: "https://support.google.com/gemini/answer/15235603",
      verifiedAt: "2026-09-30"
    }
  }),
  defineSurface({
    id: "gemini-personal-instructions",
    provider: "google",
    product: "Gemini",
    label: "Personal Instructions",
    instructionRole: "persistent",
    characterLimit: { kind: "unknown" },
    tokenLimitNote: "Google documents persistent Gemini instructions but does not publish a verified hard character limit here.",
    source: {
      label: "Gemini Apps Help",
      url: "https://support.google.com/gemini/answer/16598625",
      verifiedAt: "2026-09-30"
    }
  }),
  defineSurface({
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
  }),
  defineSurface({
    id: "gemini-api-user",
    provider: "google",
    product: "Gemini API",
    label: "User prompt",
    instructionRole: "user",
    characterLimit: { kind: "unknown" },
    tokenLimitNote: "The usable budget depends on the selected Gemini model context window.",
    source: {
      label: "Gemini API documentation",
      url: "https://ai.google.dev/api/generate-content",
      verifiedAt: "2026-09-30"
    }
  })
] as const
