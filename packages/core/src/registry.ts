import { ANTHROPIC_SURFACES } from "./targets/anthropic"
import { assertUniqueSurfaceIds } from "./targets/define"
import { GOOGLE_SURFACES } from "./targets/google"
import { OPENAI_SURFACES } from "./targets/openai"
import type { PlanId, PromptSurface } from "./types"

export const SURFACES: readonly PromptSurface[] = [
  ...OPENAI_SURFACES,
  ...ANTHROPIC_SURFACES,
  ...GOOGLE_SURFACES
]

assertUniqueSurfaceIds(SURFACES)

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
