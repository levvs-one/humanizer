import { describe, expect, it } from "vitest"
import {
  createPromptDraftDocument,
  duplicatePromptDraftDocument,
  parsePromptDraftDocument,
  repairPromptDraftReferences,
  serializePromptDraftDocument,
  updatePromptDraftDocument
} from "./draft"

describe("prompt draft documents", () => {
  it("creates and serializes a versioned draft", () => {
    const draft = createPromptDraftDocument({
      id: "review-service",
      name: "Review Service",
      profileId: "principal-engineer",
      projectId: "payments",
      target: {
        surfaceId: "openai-api-user",
        modelId: "gpt-5.6-sol",
        optimization: "maximum-fidelity"
      },
      behaviorOverrides: {
        "communication.verbosity": "high",
        "research.rigor": 100
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
    expect(draft.behaviorOverrides["communication.verbosity"]).toBe("high")
    expect(draft.projectId).toBe("payments")
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
    expect(copy.behaviorOverrides).toEqual(draft.behaviorOverrides)
    expect(copy.projectId).toBe(draft.projectId)
  })

  it("migrates schema v1 drafts with no behavior overrides", () => {
    const legacy = JSON.stringify({
      schemaVersion: 1,
      id: "legacy",
      name: "Legacy",
      profileId: "principal-engineer",
      target: { surfaceId: "chatgpt-user-prompt" },
      brief: {
        goal: "",
        context: "",
        output: "",
        constraints: ""
      },
      createdAt: "2026-09-30T14:00:00.000Z",
      updatedAt: "2026-09-30T14:00:00.000Z"
    })

    const migrated = parsePromptDraftDocument(legacy)

    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.behaviorOverrides).toEqual({})
    expect(migrated.projectId).toBeNull()
  })

  it("migrates schema v2 drafts without a project reference", () => {
    const current = createPromptDraftDocument({
      id: "legacy-v2",
      profileId: "principal-engineer",
      behaviorOverrides: { "research.rigor": 100 },
      target: { surfaceId: "chatgpt-user-prompt" },
      now: "2026-09-30T14:00:00.000Z"
    })
    const { projectId: _projectId, ...legacy } = current

    const migrated = parsePromptDraftDocument(
      JSON.stringify({ ...legacy, schemaVersion: 2 })
    )

    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.projectId).toBeNull()
    expect(migrated.behaviorOverrides["research.rigor"]).toBe(100)
  })

  it("rejects invalid project references", () => {
    const draft = createPromptDraftDocument({
      id: "draft",
      profileId: "principal-engineer",
      target: { surfaceId: "chatgpt-user-prompt" }
    })

    expect(() =>
      parsePromptDraftDocument(
        JSON.stringify({ ...draft, projectId: 42 })
      )
    ).toThrow("invalid or incomplete")
  })

  it("rejects invalid behavior overrides", () => {
    const draft = createPromptDraftDocument({
      id: "draft",
      profileId: "principal-engineer",
      target: { surfaceId: "chatgpt-user-prompt" }
    })
    const serialized = JSON.stringify({
      ...draft,
      behaviorOverrides: { "communication.verbosity": "maximum" }
    })

    expect(() => parsePromptDraftDocument(serialized)).toThrow(
      "invalid or incomplete"
    )
  })

  it("repairs missing profile and project references", () => {
    const draft = createPromptDraftDocument({
      id: "draft",
      profileId: "deleted-profile",
      projectId: "deleted-project",
      target: { surfaceId: "chatgpt-user-prompt" },
      now: "2026-09-30T14:00:00.000Z"
    })

    const repaired = repairPromptDraftReferences(
      draft,
      {
        profileIds: ["principal-engineer", "writer"],
        projectIds: ["payments"],
        fallbackProfileId: "principal-engineer"
      },
      "2026-09-30T15:00:00.000Z"
    )

    expect(repaired.profileId).toBe("principal-engineer")
    expect(repaired.projectId).toBeNull()
    expect(repaired.createdAt).toBe(draft.createdAt)
    expect(repaired.updatedAt).toBe("2026-09-30T15:00:00.000Z")
  })

  it("leaves valid references untouched without changing document identity", () => {
    const draft = createPromptDraftDocument({
      id: "draft",
      profileId: "principal-engineer",
      projectId: "payments",
      target: { surfaceId: "chatgpt-user-prompt" },
      now: "2026-09-30T14:00:00.000Z"
    })

    const repaired = repairPromptDraftReferences(draft, {
      profileIds: ["principal-engineer"],
      projectIds: ["payments"],
      fallbackProfileId: "principal-engineer"
    })

    expect(repaired).toBe(draft)
    expect(repaired.updatedAt).toBe("2026-09-30T14:00:00.000Z")
  })

  it("requires the fallback profile to exist", () => {
    const draft = createPromptDraftDocument({
      id: "draft",
      profileId: "missing",
      target: { surfaceId: "chatgpt-user-prompt" }
    })

    expect(() =>
      repairPromptDraftReferences(draft, {
        profileIds: ["writer"],
        projectIds: [],
        fallbackProfileId: "principal-engineer"
      })
    ).toThrow("Fallback profile must exist")
  })

  it("rejects malformed imports", () => {
    expect(() =>
      parsePromptDraftDocument('{"schemaVersion":1,"name":"broken"}')
    ).toThrow("invalid or incomplete")
  })
})
