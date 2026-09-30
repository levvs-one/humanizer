import type { PromptSurface } from "../types"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const STABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function defineSurface(surface: PromptSurface): PromptSurface {
  if (!STABLE_ID.test(surface.id)) {
    throw new Error("Target surface id must use lowercase kebab-case: " + surface.id)
  }

  if (!surface.product.trim() || !surface.label.trim()) {
    throw new Error("Target surface product and label are required: " + surface.id)
  }

  if (!surface.source.label.trim()) {
    throw new Error("Target surface source label is required: " + surface.id)
  }

  let sourceUrl: URL
  try {
    sourceUrl = new URL(surface.source.url)
  } catch {
    throw new Error("Target surface source URL is invalid: " + surface.id)
  }

  if (sourceUrl.protocol !== "https:") {
    throw new Error("Target surface source URL must use HTTPS: " + surface.id)
  }

  if (!ISO_DATE.test(surface.source.verifiedAt)) {
    throw new Error("Target surface verification date must be YYYY-MM-DD: " + surface.id)
  }

  if (surface.characterLimit.kind === "fixed" && surface.characterLimit.value <= 0) {
    throw new Error("Fixed character limit must be positive: " + surface.id)
  }

  if (surface.characterLimit.kind === "by-plan") {
    for (const [plan, value] of Object.entries(surface.characterLimit.values)) {
      if (value !== undefined && value <= 0) {
        throw new Error(
          "Plan character limit must be positive for " + plan + ": " + surface.id
        )
      }
    }
  }

  return surface
}

export function assertUniqueSurfaceIds(surfaces: readonly PromptSurface[]): void {
  const seen = new Set<string>()

  for (const surface of surfaces) {
    if (seen.has(surface.id)) {
      throw new Error("Duplicate target surface id: " + surface.id)
    }

    seen.add(surface.id)
  }
}
