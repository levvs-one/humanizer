import { describe, expect, it } from "vitest"
import { compilePrompt, resolveCharacterLimit, SURFACES } from "./index"
import type { BehaviorProfile } from "./types"

const profile: BehaviorProfile = {
  role: "Principal software engineer",
  objective: "Solve engineering tasks with production-quality judgment.",
  purpose: "engineering",
  communication: {
    naturalness: 90,
    directness: 90,
    verbosity: "low"
  },
  research: {
    rigor: 90,
    preferPrimarySources: true,
    allowCommunitySources: true
  },
  writing: {
    avoidAISlop: true,
    avoidUnnecessaryHeadings: true,
    avoidRestatingPrompt: true
  }
}

describe("surface registry", () => {
  it("resolves current ChatGPT plan limits", () => {
    const surface = SURFACES.find(
      (entry) => entry.id === "chatgpt-custom-instructions"
    )

    expect(surface).toBeDefined()
    expect(resolveCharacterLimit(surface!, "free")).toBe(1500)
    expect(resolveCharacterLimit(surface!, "plus")).toBe(5000)
  })
})

describe("compilePrompt", () => {
  it("fits a normal profile into paid ChatGPT custom instructions", () => {
    const result = compilePrompt({
      profile,
      target: {
        surfaceId: "chatgpt-custom-instructions",
        plan: "plus"
      }
    })

    expect(result.status).toBe("fits")
    expect(result.characterCount).toBeLessThanOrEqual(5000)
    expect(result.text).toContain("Principal software engineer")
    expect(result.text).not.toContain("I work at")
  })

  it("does not pretend an unknown API character limit exists", () => {
    const result = compilePrompt({
      profile,
      target: { surfaceId: "anthropic-api-system" }
    })

    expect(result.status).toBe("no-verified-limit")
    expect(result.characterLimit).toBeNull()
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it("never slices critical user intent to satisfy a hard limit", () => {
    const objective = "x".repeat(1800)
    const result = compilePrompt({
      profile: { ...profile, objective },
      target: {
        surfaceId: "chatgpt-custom-instructions",
        plan: "free"
      }
    })

    expect(result.status).toBe("overflow")
    expect(result.text).toContain(objective)
  })
})
