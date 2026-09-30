import { describe, expect, it } from "vitest"
import { orderPromptBlocks, renderPromptBlock } from "./dialects"
import { buildPromptIR } from "./prompt-ir"
import { getSurface } from "./registry"
import type { BehaviorProfile } from "./types"

const profile: BehaviorProfile = {
  role: "Principal software engineer",
  objective: "Solve the task cleanly.",
  purpose: "engineering",
  communication: {
    naturalness: 88,
    directness: 92,
    formality: 35,
    humor: 10,
    verbosity: "low"
  },
  reasoning: {
    initiative: 90,
    verification: 95,
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

const brief = {
  goal: "Review the implementation.",
  context: "The service is written in TypeScript.",
  output: "Return the root cause and fix.",
  constraints: "Do not invent APIs."
}

describe("provider dialects", () => {
  it("renders OpenAI prompts as Markdown sections", () => {
    const surface = getSurface("openai-api-developer")
    const role = buildPromptIR(profile, brief).blocks.find((block) => block.id === "role")

    expect(role).toBeDefined()
    expect(renderPromptBlock(role!, "full", surface)).toMatch(/^# Role\n/)
  })

  it("renders Anthropic prompts with descriptive XML tags", () => {
    const surface = getSurface("anthropic-api-system")
    const task = buildPromptIR(profile, brief).blocks.find((block) => block.id === "task")

    expect(task).toBeDefined()
    expect(renderPromptBlock(task!, "full", surface)).toContain("<task>\n")
    expect(renderPromptBlock(task!, "full", surface)).toContain("\n</task>")
  })

  it("renders Gemini prompts with one consistent XML dialect", () => {
    const surface = getSurface("gemini-api-system")
    const constraints = buildPromptIR(profile, brief).blocks.find(
      (block) => block.id === "constraints"
    )

    expect(constraints).toBeDefined()
    expect(renderPromptBlock(constraints!, "full", surface)).toContain("<constraints>")
  })

  it("puts OpenAI user task before behavior policy", () => {
    const surface = getSurface("openai-api-user")
    const ordered = orderPromptBlocks(buildPromptIR(profile, brief).blocks, surface)

    expect(ordered[0]?.id).toBe("task")
    expect(ordered.findIndex((block) => block.id === "role")).toBeGreaterThan(0)
  })

  it("puts Gemini task after context and policy for standalone user prompts", () => {
    const surface = getSurface("gemini-api-user")
    const ordered = orderPromptBlocks(buildPromptIR(profile, brief).blocks, surface)

    expect(ordered.findIndex((block) => block.id === "context"))
      .toBeLessThan(ordered.findIndex((block) => block.id === "task"))
    expect(ordered.findIndex((block) => block.id === "role"))
      .toBeLessThan(ordered.findIndex((block) => block.id === "context"))
  })
})
