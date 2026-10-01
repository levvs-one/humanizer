import { describe, expect, it } from "vitest"
import { createProjectDocument } from "./project"
import { resolveBehaviorScopes } from "./scopes"
import type { BehaviorProfile } from "./types"

const profile: BehaviorProfile = {
  role: "Principal engineer",
  objective: "Ship reliable software.",
  purpose: "engineering",
  customRules: ["Use documented APIs."],
  communication: {
    naturalness: 80,
    directness: 80,
    formality: 40,
    humor: 5,
    verbosity: "medium"
  },
  reasoning: {
    initiative: 80,
    verification: 90,
    uncertaintyHandling: "explicit"
  },
  research: {
    rigor: 80,
    preferPrimarySources: true,
    allowCommunitySources: true
  },
  tools: {
    usage: "when-useful",
    confirmExternalActions: true,
    preferReadOnly: true
  },
  writing: {
    avoidAISlop: true,
    avoidUnnecessaryHeadings: true,
    avoidRestatingPrompt: true
  }
}

describe("scoped behavior resolution", () => {
  it("applies profile, project, model, then task precedence", () => {
    const project = createProjectDocument({
      id: "payments",
      name: "Payments",
      behaviorOverrides: {
        role: "Payments engineer",
        "communication.directness": 70,
        "research.rigor": 90
      },
      modelOverrides: {
        "gpt-5.6-sol": {
          "communication.directness": 60,
          "reasoning.verification": 100
        }
      }
    })

    const resolved = resolveBehaviorScopes({
      profile,
      project,
      modelId: "gpt-5.6-sol",
      taskOverrides: {
        "communication.directness": 50
      }
    })

    expect(resolved.projectProfile.role).toBe("Payments engineer")
    expect(resolved.projectProfile.communication.directness).toBe(70)
    expect(resolved.modelProfile.communication.directness).toBe(60)
    expect(resolved.modelProfile.reasoning.verification).toBe(100)
    expect(resolved.effectiveProfile.communication.directness).toBe(50)
    expect(resolved.effectiveProfile.research.rigor).toBe(90)
  })

  it("ignores model overrides for a different model", () => {
    const project = createProjectDocument({
      id: "payments",
      name: "Payments",
      modelOverrides: {
        "claude-sonnet-5": {
          "communication.verbosity": "high"
        }
      }
    })

    const resolved = resolveBehaviorScopes({
      profile,
      project,
      modelId: "gpt-5.6-sol"
    })

    expect(resolved.modelProfile.communication.verbosity).toBe("medium")
  })

  it("does not mutate the profile or project", () => {
    const project = createProjectDocument({
      id: "payments",
      name: "Payments",
      behaviorOverrides: {
        customRules: ["Project rule"]
      }
    })

    const resolved = resolveBehaviorScopes({
      profile,
      project,
      taskOverrides: {
        customRules: ["Task rule"]
      }
    })

    resolved.effectiveProfile.customRules.push("Mutation")

    expect(profile.customRules).toEqual(["Use documented APIs."])
    expect(project.behaviorOverrides.customRules).toEqual(["Project rule"])
  })
})
