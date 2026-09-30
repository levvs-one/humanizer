import { describe, expect, it } from "vitest"
import { buildTargetExport } from "./exporter"
import { getSurface } from "./registry"

function result(surfaceId: string, text = "Compiled prompt") {
  return {
    text,
    surface: getSurface(surfaceId)
  }
}

describe("target export", () => {
  it("exports product instruction surfaces as plain text", () => {
    const artifact = buildTargetExport(result("chatgpt-custom-instructions"))

    expect(artifact.format).toBe("text")
    expect(artifact.extension).toBe("txt")
    expect(artifact.content).toBe("Compiled prompt\n")
  })

  it("exports OpenAI developer instructions through the Responses instructions field", () => {
    const artifact = buildTargetExport(result("openai-api-developer"))
    const payload = JSON.parse(artifact.content)

    expect(artifact.label).toBe("OpenAI Responses instructions")
    expect(payload).toEqual({ instructions: "Compiled prompt" })
  })

  it("exports OpenAI user prompts through the Responses input field", () => {
    const artifact = buildTargetExport(result("openai-api-user"))
    expect(JSON.parse(artifact.content)).toEqual({
      input: "Compiled prompt"
    })
  })

  it("exports Claude system and user fragments for Messages API", () => {
    const system = buildTargetExport(result("anthropic-api-system"))
    const user = buildTargetExport(result("anthropic-api-user"))

    expect(JSON.parse(system.content)).toEqual({
      system: "Compiled prompt"
    })
    expect(JSON.parse(user.content)).toEqual({
      messages: [
        {
          role: "user",
          content: "Compiled prompt"
        }
      ]
    })
  })

  it("exports Gemini system instructions and user contents", () => {
    const system = buildTargetExport(result("gemini-api-system"))
    const user = buildTargetExport(result("gemini-api-user"))

    expect(JSON.parse(system.content)).toEqual({
      system_instruction: {
        parts: [{ text: "Compiled prompt" }]
      }
    })
    expect(JSON.parse(user.content)).toEqual({
      contents: [
        {
          role: "user",
          parts: [{ text: "Compiled prompt" }]
        }
      ]
    })
  })
})
