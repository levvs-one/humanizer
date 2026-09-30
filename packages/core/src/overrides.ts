import { BEHAVIOR_FIELD_PATHS, type BehaviorFieldPath } from "./profile"
import type { BehaviorProfile, PromptPurpose, UncertaintyHandling, Verbosity } from "./types"

export type BehaviorOverrideValue = string | number | boolean | string[]

export type BehaviorOverrideSet = Partial<
  Record<BehaviorFieldPath, BehaviorOverrideValue>
>

const PURPOSES: readonly PromptPurpose[] = [
  "general",
  "engineering",
  "research",
  "writing",
  "agent"
]

const VERBOSITIES: readonly Verbosity[] = ["low", "medium", "high"]

const UNCERTAINTY_HANDLING: readonly UncertaintyHandling[] = [
  "quiet",
  "explicit",
  "strict"
]

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean"
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

export function isBehaviorOverrideValue(
  path: BehaviorFieldPath,
  value: unknown
): value is BehaviorOverrideValue {
  switch (path) {
    case "role":
    case "objective":
      return typeof value === "string"
    case "purpose":
      return typeof value === "string" && PURPOSES.includes(value as PromptPurpose)
    case "customRules":
      return isStringArray(value)
    case "communication.naturalness":
    case "communication.directness":
    case "communication.formality":
    case "communication.humor":
    case "reasoning.initiative":
    case "reasoning.verification":
    case "research.rigor":
      return isFiniteNumber(value)
    case "communication.verbosity":
      return typeof value === "string" && VERBOSITIES.includes(value as Verbosity)
    case "reasoning.uncertaintyHandling":
      return (
        typeof value === "string" &&
        UNCERTAINTY_HANDLING.includes(value as UncertaintyHandling)
      )
    case "research.preferPrimarySources":
    case "research.allowCommunitySources":
    case "writing.avoidAISlop":
    case "writing.avoidUnnecessaryHeadings":
    case "writing.avoidRestatingPrompt":
      return isBoolean(value)
  }
}

export function isBehaviorOverrideSet(value: unknown): value is BehaviorOverrideSet {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>

  return Object.entries(record).every(([path, entry]) => {
    if (!(BEHAVIOR_FIELD_PATHS as readonly string[]).includes(path)) {
      return false
    }

    return isBehaviorOverrideValue(path as BehaviorFieldPath, entry)
  })
}

export function countBehaviorOverrides(overrides: BehaviorOverrideSet): number {
  return Object.keys(overrides).length
}

export function applyBehaviorOverrides(
  source: BehaviorProfile,
  overrides: BehaviorOverrideSet
): BehaviorProfile {
  const profile = structuredClone(source)

  for (const path of BEHAVIOR_FIELD_PATHS) {
    if (!Object.prototype.hasOwnProperty.call(overrides, path)) {
      continue
    }

    const value = overrides[path]
    if (!isBehaviorOverrideValue(path, value)) {
      continue
    }

    switch (path) {
      case "role":
        profile.role = value as string
        break
      case "objective":
        profile.objective = value as string
        break
      case "purpose":
        profile.purpose = value as PromptPurpose
        break
      case "customRules":
        profile.customRules = [...(value as string[])]
        break
      case "communication.naturalness":
        profile.communication.naturalness = value as number
        break
      case "communication.directness":
        profile.communication.directness = value as number
        break
      case "communication.formality":
        profile.communication.formality = value as number
        break
      case "communication.humor":
        profile.communication.humor = value as number
        break
      case "communication.verbosity":
        profile.communication.verbosity = value as Verbosity
        break
      case "reasoning.initiative":
        profile.reasoning.initiative = value as number
        break
      case "reasoning.verification":
        profile.reasoning.verification = value as number
        break
      case "reasoning.uncertaintyHandling":
        profile.reasoning.uncertaintyHandling = value as UncertaintyHandling
        break
      case "research.rigor":
        profile.research.rigor = value as number
        break
      case "research.preferPrimarySources":
        profile.research.preferPrimarySources = value as boolean
        break
      case "research.allowCommunitySources":
        profile.research.allowCommunitySources = value as boolean
        break
      case "writing.avoidAISlop":
        profile.writing.avoidAISlop = value as boolean
        break
      case "writing.avoidUnnecessaryHeadings":
        profile.writing.avoidUnnecessaryHeadings = value as boolean
        break
      case "writing.avoidRestatingPrompt":
        profile.writing.avoidRestatingPrompt = value as boolean
        break
    }
  }

  return profile
}

export function applyBehaviorOverrideLayers(
  source: BehaviorProfile,
  layers: readonly BehaviorOverrideSet[]
): BehaviorProfile {
  return layers.reduce(
    (profile, overrides) => applyBehaviorOverrides(profile, overrides),
    structuredClone(source)
  )
}
