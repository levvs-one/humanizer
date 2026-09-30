import { describe, expect, it } from "vitest"
import {
  applyBehaviorOverrideLayers,
  applyBehaviorOverrides,
  countBehaviorOverrides,
  isBehaviorOverrideSet
} from "./overrides"
import type { BehaviorProfile } from "./types"

const profile: BehaviorProfile = {
  role: "Principal engineer",
  objective: "Ship reliable systems.",
  purpose: "engineering",
  customRules: ["Never invent completed actions."],
  communication: {
    naturalness: 85,
    directness: 90,
    formality: 35,
    humor: 10,
    verbosity: "low"
  },
  reasoning: {
    initiative: 90,
    verification: 95,
    uncertaintyHandling: "explicit"
  },
  research: {
    rigor: 90,
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

describe("behavior overrides", () => {
  it("changes only the selected behavior fields", () => {
    const resolved = applyBehaviorOverrides(profile, {
      "communication.directness": 55,
      "communication.verbosity": "high",
      objective: "Review a risky migration."
    })

    expect(resolved.communication.directness).toBe(55)
    expect(resolved.communication.verbosity).toBe("high")
    expect(resolved.objective).toBe("Review a risky migration.")
    expect(resolved.reasoning.verification).toBe(95)
    expect(profile.communication.directness).toBe(90)
  })

  it("applies later scopes last", () => {
    const resolved = applyBehaviorOverrideLayers(profile, [
      { "research.rigor": 70, "reasoning.initiative": 60 },
      { "reasoning.initiative": 25 }
    ])

    expect(resolved.research.rigor).toBe(70)
    expect(resolved.reasoning.initiative).toBe(25)
  })

  it("validates serialized override sets", () => {
    expect(
      isBehaviorOverrideSet({
        "communication.verbosity": "medium",
        "research.preferPrimarySources": false
      })
    ).toBe(true)

    expect(isBehaviorOverrideSet({ "communication.verbosity": "extreme" })).toBe(false)
    expect(isBehaviorOverrideSet({ "communication.directness": 101 })).toBe(false)
    expect(isBehaviorOverrideSet({ "communication.directness": -1 })).toBe(false)
    expect(isBehaviorOverrideSet({ unknown: true })).toBe(false)
  })

  it("applies scoped tool policy overrides", () => {
    const resolved = applyBehaviorOverrides(profile, {
      "tools.usage": "off",
      "tools.confirmExternalActions": false
    })

    expect(resolved.tools.usage).toBe("off")
    expect(resolved.tools.confirmExternalActions).toBe(false)
    expect(resolved.tools.preferReadOnly).toBe(true)
  })

  it("counts only explicit overrides", () => {
    expect(
      countBehaviorOverrides({
        role: "Reviewer",
        "reasoning.verification": 100
      })
    ).toBe(2)
  })
})
