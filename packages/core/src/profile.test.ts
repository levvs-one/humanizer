import { describe, expect, it } from "vitest"
import {
  createProfileDocument,
  duplicateProfileDocument,
  parseProfileDocument,
  serializeProfileDocument,
  updateProfileDocument
} from "./profile"
import type { BehaviorProfile } from "./types"

const profile: BehaviorProfile = {
  role: "Research engineer",
  objective: "Investigate technical questions using primary evidence.",
  purpose: "research",
  communication: {
    naturalness: 80,
    directness: 82,
    verbosity: "medium"
  },
  research: {
    rigor: 96,
    preferPrimarySources: true,
    allowCommunitySources: true
  },
  writing: {
    avoidAISlop: true,
    avoidUnnecessaryHeadings: true,
    avoidRestatingPrompt: true
  }
}

describe("profile documents", () => {
  it("creates a stable versioned document", () => {
    const document = createProfileDocument({
      id: "research",
      name: "Research",
      profile,
      now: "2026-09-30T12:00:00.000Z"
    })

    expect(document.schemaVersion).toBe(1)
    expect(document.id).toBe("research")
    expect(document.createdAt).toBe(document.updatedAt)
  })

  it("round-trips through the export format", () => {
    const document = createProfileDocument({
      id: "research",
      name: "Research",
      profile,
      now: "2026-09-30T12:00:00.000Z"
    })

    expect(parseProfileDocument(serializeProfileDocument(document))).toEqual(document)
  })

  it("duplicates with a new id and preserves behavior", () => {
    const original = createProfileDocument({
      id: "research",
      name: "Research",
      profile,
      now: "2026-09-30T12:00:00.000Z"
    })
    const duplicate = duplicateProfileDocument(original, {
      name: "Research strict",
      now: "2026-09-30T13:00:00.000Z"
    })

    expect(duplicate.id).not.toBe(original.id)
    expect(duplicate.name).toBe("Research strict")
    expect(duplicate.profile).toEqual(original.profile)
  })

  it("updates metadata without changing creation time", () => {
    const original = createProfileDocument({
      id: "research",
      name: "Research",
      profile,
      now: "2026-09-30T12:00:00.000Z"
    })
    const updated = updateProfileDocument(
      original,
      { name: "Research Pro" },
      "2026-09-30T13:00:00.000Z"
    )

    expect(updated.name).toBe("Research Pro")
    expect(updated.createdAt).toBe(original.createdAt)
    expect(updated.updatedAt).toBe("2026-09-30T13:00:00.000Z")
  })

  it("rejects malformed imports", () => {
    expect(() => parseProfileDocument('{"schemaVersion":1}')).toThrow(
      "Profile file is invalid or incomplete."
    )
  })
})
