import { describe, expect, it } from "vitest"
import { compilePrompt, resolveCharacterLimit, SURFACES } from "./index"
import type { BehaviorProfile } from "./types"

const profile: BehaviorProfile = {
  role: "Principal software engineer",
  objective: "Solve engineering tasks with production-quality judgment.",
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

  it("preserves reusable hard rules in compiled prompts", () => {
    const result = compilePrompt({
      profile: {
        ...profile,
        customRules: ["Never claim a command ran unless it actually ran."]
      },
      target: {
        surfaceId: "openai-api-developer",
        modelId: "gpt-5.6-sol"
      }
    })

    expect(result.text).toContain("Hard rules")
    expect(result.text).toContain("Never claim a command ran unless it actually ran.")
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


describe("task-specific compilation", () => {
  it("puts task intent first for user prompts", () => {
    const result = compilePrompt({
      profile,
      brief: {
        goal: "Review the supplied implementation and propose the smallest safe fix.",
        context: "The project uses TypeScript.",
        output: "Return the cause, patch plan, and verification steps.",
        constraints: "Do not invent library APIs."
      },
      target: {
        surfaceId: "openai-api-user",
        modelId: "gpt-5.6-sol"
      }
    })

    expect(result.text.startsWith("Task\nReview the supplied implementation")).toBe(true)
    expect(result.text).toContain("Constraints\nDo not invent library APIs.")
    expect(result.model?.id).toBe("gpt-5.6-sol")
  })

  it("puts Gemini 3 context before the final task in user prompts", () => {
    const result = compilePrompt({
      profile,
      brief: {
        goal: "Identify the smallest safe fix.",
        context: "The repository contains a large existing implementation.",
        output: "Return the diagnosis and patch plan.",
        constraints: "Preserve public behavior."
      },
      target: {
        surfaceId: "gemini-api-user",
        modelId: "gemini-3.8-flash"
      }
    })

    const contextIndex = result.text.indexOf("Context\n")
    const taskIndex = result.text.indexOf("Task\n")

    expect(contextIndex).toBe(0)
    expect(taskIndex).toBeGreaterThan(contextIndex)
    expect(result.text.trim().endsWith("Identify the smallest safe fix.")).toBe(true)
  })

  it("keeps non-Gemini user prompts task-first", () => {
    const result = compilePrompt({
      profile,
      brief: {
        goal: "Identify the smallest safe fix.",
        context: "The repository contains a large existing implementation.",
        output: "",
        constraints: ""
      },
      target: {
        surfaceId: "openai-api-user",
        modelId: "gpt-5.6-sol"
      }
    })

    expect(result.text.startsWith("Task\nIdentify the smallest safe fix.")).toBe(true)
  })

  it("warns when a model and target provider do not match", () => {
    const result = compilePrompt({
      profile,
      target: {
        surfaceId: "anthropic-api-system",
        modelId: "gpt-5.6-sol"
      }
    })

    expect(result.warnings.some((warning) => warning.includes("does not match"))).toBe(true)
  })
})


describe("provider-specific rendering", () => {
  it("uses structural XML for Claude targets", () => {
    const result = compilePrompt({
      profile,
      brief: {
        goal: "Summarize the supplied engineering decision.",
        context: "",
        output: "Return one concise recommendation.",
        constraints: ""
      },
      target: {
        surfaceId: "anthropic-api-system",
        modelId: "claude-sonnet-5"
      }
    })

    expect(result.text).toContain("<role>")
    expect(result.text).toContain("<task>")
    expect(result.text).toContain("</task>")
  })

  it("keeps OpenAI prompts in clean text sections", () => {
    const result = compilePrompt({
      profile,
      brief: {
        goal: "Summarize the supplied engineering decision.",
        context: "",
        output: "",
        constraints: ""
      },
      target: {
        surfaceId: "openai-api-developer",
        modelId: "gpt-5.6-sol"
      }
    })

    expect(result.text).toContain("Role\n")
    expect(result.text).not.toContain("<role>")
  })
})


describe("prompt optimization", () => {
  it("uses compact variants immediately in compact mode", () => {
    const result = compilePrompt({
      profile,
      target: {
        surfaceId: "chatgpt-custom-instructions",
        plan: "plus",
        optimization: "compact"
      }
    })

    expect(result.optimization).toBe("compact")
    expect(result.compactedBlocks.length).toBeGreaterThan(0)
    expect(result.text).toContain("Be natural, direct, and concise.")
  })

  it("preserves full instructions in maximum fidelity mode", () => {
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

    expect(result.status).toBe("overflow")
    expect(result.compactedBlocks).toEqual([])
    expect(result.omittedBlocks).toEqual([])
    expect(result.warnings.some((warning) => warning.includes("Maximum fidelity"))).toBe(true)
  })

  it("warns when a user prompt has no concrete task", () => {
    const result = compilePrompt({
      profile,
      target: {
        surfaceId: "openai-api-user",
        modelId: "gpt-5.6-sol"
      }
    })

    expect(result.warnings.some((warning) => warning.startsWith("Add a task."))).toBe(true)
  })
})
