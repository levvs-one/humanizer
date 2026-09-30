import { describe, expect, it } from "vitest"
import {
  createPromptDraftDocument,
  duplicatePromptDraftDocument,
  parsePromptDraftDocument,
  serializePromptDraftDocument,
  updatePromptDraftDocument
} from "./draft"

describe("prompt draft documents", () => {
  it("creates and serializes a versioned draft", () => {
    const draft = createPromptDraftDocument({
      id: "review-service",
      name: "Review Service",
      profileId: "principal-engineer",
      target: {
        surfaceId: "openai-api-user",
        modelId: "gpt-5.6-sol",
        optimization: "maximum-fidelity"
      },
      brief: {
        purpose: "research",
        goal: "Review the service.",
        context: "TypeScript.",
        output: "Return the root cause.",
        constraints: "Do not invent APIs."
      },
      now: "2026-09-30T14:00:00.000Z"
    })

    expect(parsePromptDraftDocument(serializePromptDraftDocument(draft))).toEqual(draft)
    expect(draft.target.optimization).toBe("maximum-fidelity")
    expect(draft.brief.purpose).toBe("research")
  })

  it("updates content without changing creation time", () => {
    const draft = createPromptDraftDocument({
      id: "draft",
      profileId: "principal-engineer",
      target: { surfaceId: "chatgpt-user-prompt" },
      now: "2026-09-30T14:00:00.000Z"
    })

    const updated = updatePromptDraftDocument(
      draft,
      {
        name: "Production review",
        brief: {
          ...draft.brief,
          goal: "Review the production implementation."
        }
      },
      "2026-09-30T14:30:00.000Z"
    )

    expect(updated.createdAt).toBe(draft.createdAt)
    expect(updated.updatedAt).toBe("2026-09-30T14:30:00.000Z")
    expect(updated.brief.goal).toContain("production")
  })

  it("duplicates with a fresh id", () => {
    const draft = createPromptDraftDocument({
      id: "draft",
      name: "Draft",
      profileId: "principal-engineer",
      target: { surfaceId: "chatgpt-user-prompt" }
    })

    const copy = duplicatePromptDraftDocument(draft)

    expect(copy.id).not.toBe(draft.id)
    expect(copy.name).toBe("Draft Copy")
    expect(copy.brief).toEqual(draft.brief)
  })

  it("rejects malformed imports", () => {
    expect(() =>
      parsePromptDraftDocument('{"schemaVersion":1,"name":"broken"}')
    ).toThrow("invalid or incomplete")
  })
})
