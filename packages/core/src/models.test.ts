import { describe, expect, it } from "vitest"
import { getModel, getModelsForProvider, MODELS } from "./models"

describe("model registry", () => {
  it("contains stable unique ids", () => {
    const ids = MODELS.map((model) => model.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("resolves models by provider", () => {
    const openai = getModelsForProvider("openai")
    expect(openai.length).toBeGreaterThan(0)
    expect(openai.every((model) => model.provider === "openai")).toBe(true)
  })

  it("records verified Gemini 3.8 limits and provider token counting", () => {
    const model = getModel("gemini-3.8-flash")
    expect(model.contextWindowTokens).toBe(1_000_000)
    expect(model.maxOutputTokens).toBe(64_000)
    expect(model.tokenCounting).toBe("provider-api")
  })

  it("keeps unavailable preflight counting explicit for OpenAI models", () => {
    expect(getModel("gpt-5.6-sol").tokenCounting).toBe("unavailable")
  })

  it("includes the current Claude 5.5 lineup", () => {
    expect(getModel("claude-opus-5-5").contextWindowTokens).toBe(1_000_000)
    expect(getModel("claude-sonnet-5-5").maxOutputTokens).toBe(128_000)
  })
})
