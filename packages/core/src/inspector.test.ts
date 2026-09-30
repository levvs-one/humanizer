import { describe, expect, it } from "vitest"
import { compilePrompt } from "./compiler"
import type { BehaviorProfile } from "./types"

const profile: BehaviorProfile = {
  role: "Principal software engineer",
  objective: "Ship reliable systems.",
  purpose: "engineering",
  communication: {
    naturalness: 90,
    directness: 90,
    formality: 35,
    humor: 12,
    verbosity: "low"
  },
  reasoning: {
    initiative: 92,
    verification: 96,
    uncertaintyHandling: "quiet"
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

describe("prompt inspector", () => {
  it("flags a missing task on user prompts", () => {
    const result = compilePrompt({
      profile,
      target: {
        surfaceId: "openai-api-user",
        modelId: "gpt-5.6-sol"
      }
    })

    expect(result.diagnostics).toContainEqual({
      code: "missing-task",
      severity: "warning",
      message: "Add a concrete task before using this as a user prompt."
    })
  })

  it("flags decorative inline separators only in source instructions", () => {
    const result = compilePrompt({
      profile: {
        ...profile,
        objective: "Review the code · verify the API · return the smallest safe change."
      },
      target: {
        surfaceId: "openai-api-developer",
        modelId: "gpt-5.6-sol"
      }
    })

    expect(result.diagnostics.some((item) => item.code === "decorative-separator")).toBe(true)
  })

  it("flags canned assistant phrasing in source instructions", () => {
    const result = compilePrompt({
      profile,
      brief: {
        goal: "Here's a comprehensive review of the implementation.",
        context: "",
        output: "",
        constraints: ""
      },
      target: {
        surfaceId: "openai-api-user",
        modelId: "gpt-5.6-sol"
      }
    })

    expect(result.diagnostics.some((item) => item.code === "canned-ai-phrase")).toBe(true)
  })

  it("reports compaction without inventing a score", () => {
    const result = compilePrompt({
      profile,
      target: {
        surfaceId: "chatgpt-custom-instructions",
        plan: "plus",
        optimization: "compact"
      }
    })

    expect(result.diagnostics.some((item) => item.code === "compacted-blocks")).toBe(true)
    expect(JSON.stringify(result.diagnostics)).not.toMatch(/score|rating|percent/i)
  })

  it("reports verified-limit overflow as an error", () => {
    const result = compilePrompt({
      profile: {
        ...profile,
        objective: "x".repeat(1800)
      },
      target: {
        surfaceId: "chatgpt-custom-instructions",
        plan: "free",
        optimization: "maximum-fidelity"
      }
    })

    expect(result.diagnostics.some(
      (item) => item.code === "overflow" && item.severity === "error"
    )).toBe(true)
  })
})
