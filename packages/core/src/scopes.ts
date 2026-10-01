import type { BehaviorOverrideSet } from "./overrides"
import { applyBehaviorOverrideLayers } from "./overrides"
import { getProjectModelOverrides, type ProjectDocument } from "./project"
import type { BehaviorProfile } from "./types"

export interface ScopedBehaviorInput {
  profile: BehaviorProfile
  project?: ProjectDocument | null
  modelId?: string | null
  taskOverrides?: BehaviorOverrideSet
}

export interface ScopedBehaviorResolution {
  projectProfile: BehaviorProfile
  modelProfile: BehaviorProfile
  effectiveProfile: BehaviorProfile
}

export function resolveBehaviorScopes(
  input: ScopedBehaviorInput
): ScopedBehaviorResolution {
  const projectProfile = applyBehaviorOverrideLayers(input.profile, [
    input.project?.behaviorOverrides ?? {}
  ])
  const modelProfile = applyBehaviorOverrideLayers(projectProfile, [
    getProjectModelOverrides(input.project, input.modelId)
  ])
  const effectiveProfile = applyBehaviorOverrideLayers(modelProfile, [
    input.taskOverrides ?? {}
  ])

  return {
    projectProfile,
    modelProfile,
    effectiveProfile
  }
}
