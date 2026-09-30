import { describe, expect, it } from "vitest"
import { buildPromptIR, PROMPT_IR_VERSION } from "./prompt-ir"
import type { BehaviorProfile } from "./types"

const profile: BehaviorProfile = {
  role: "Principal software engineer",
  objective: "Ship reliable systems.",
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

describe("Prompt IR", () => {
  it("keeps required intent explicit", () => {
    const ir = buildPromptIR(profile)

    expect(ir.version).toBe(PROMPT_IR_VERSION)
    expect(ir.blocks.filter((block) => block.required).map((block) => block.id)).toEqual([
      "role",
      "objective",
      "accuracy"
    ])
  })

  it("encodes anti-slop behavior without fake human mistakes", () => {
    const ir = buildPromptIR(profile)
    const writing = ir.blocks.find((block) => block.id === "writing")

    expect(writing?.full).toContain("decorative punctuation")
    expect(writing?.full).toContain("Do not add typos")
  })
})
