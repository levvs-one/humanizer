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

  it("stores verified Gemini 3.8 token limits", () => {
    const model = getModel("gemini-3.8-flash")
    expect(model.contextWindowTokens).toBe(1_048_576)
    expect(model.maxOutputTokens).toBe(65_536)
  })
})
