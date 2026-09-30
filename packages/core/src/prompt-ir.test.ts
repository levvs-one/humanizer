import { describe, expect, it } from "vitest"
import { buildPromptIR, PROMPT_IR_VERSION } from "./prompt-ir"
import type { BehaviorProfile } from "./types"

const profile: BehaviorProfile = {
  role: "Principal software engineer",
  objective: "Ship reliable systems.",
  purpose: "engineering",
  customRules: [],
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

describe("Prompt IR", () => {
  it("keeps required intent explicit", () => {
    const ir = buildPromptIR(profile)

    expect(ir.version).toBe(PROMPT_IR_VERSION)
    expect(ir.blocks.filter((block) => block.required).map((block) => block.id)).toEqual([
      "role",
      "objective",
      "accuracy",
      "tools"
    ])
  })

  it("uses the profile purpose when the draft has no override", () => {
    const ir = buildPromptIR(profile)
    const strategy = ir.blocks.find((block) => block.id === "strategy")

    expect(ir.purpose).toBe("engineering")
    expect(strategy?.full).toContain("documented APIs")
  })

  it("lets a draft override the profile purpose", () => {
    const ir = buildPromptIR(profile, {
      purpose: "research",
      goal: "Investigate the claim.",
      context: "",
      output: "",
      constraints: ""
    })
    const strategy = ir.blocks.find((block) => block.id === "strategy")

    expect(ir.purpose).toBe("research")
    expect(strategy?.full).toContain("primary sources")
    expect(strategy?.full).not.toContain("smallest production-safe change")
  })

  it("keeps custom rules as required prompt intent", () => {
    const ir = buildPromptIR({
      ...profile,
      customRules: ["Never fabricate completed actions.", "Keep file paths exact."]
    })
    const rules = ir.blocks.find((block) => block.id === "rules")

    expect(rules?.required).toBe(true)
    expect(rules?.full).toContain("Never fabricate completed actions.")
    expect(rules?.full).toContain("Keep file paths exact.")
  })

  it("compiles explicit tool policy", () => {
    const off = buildPromptIR({
      ...profile,
      tools: {
        usage: "off",
        confirmExternalActions: false,
        preferReadOnly: false
      }
    })
    const tools = off.blocks.find((block) => block.id === "tools")

    expect(tools?.required).toBe(true)
    expect(tools?.full).toContain("Do not use external tools")
  })

  it("preserves tool settings in compact guidance", () => {
    const proactive = buildPromptIR({
      ...profile,
      tools: {
        usage: "proactive",
        confirmExternalActions: false,
        preferReadOnly: false
      }
    }).blocks.find((block) => block.id === "tools")

    const cautious = buildPromptIR({
      ...profile,
      tools: {
        usage: "when-useful",
        confirmExternalActions: true,
        preferReadOnly: true
      }
    }).blocks.find((block) => block.id === "tools")

    expect(proactive?.compact).toContain("proactively")
    expect(proactive?.compact).not.toContain("read-only")
    expect(cautious?.compact).toContain("Inspect read-only first")
    expect(cautious?.compact).toContain("Confirm consequential external actions")
  })

  it("keeps consequential action confirmation explicit", () => {
    const tools = buildPromptIR(profile).blocks.find((block) => block.id === "tools")

    expect(tools?.full).toContain("explicit confirmation")
    expect(tools?.full).toContain("read-only")
  })

  it("encodes anti-slop behavior without fake human mistakes", () => {
    const ir = buildPromptIR(profile)
    const writing = ir.blocks.find((block) => block.id === "writing")

    expect(writing?.full).toContain("decorative punctuation")
    expect(writing?.full).toContain("Do not add typos")
  })
})
