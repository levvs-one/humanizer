import { defineSurface } from "./define"

export const GOOGLE_SURFACES = [
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
  })
] as const
