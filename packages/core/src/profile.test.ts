import { describe, expect, it } from "vitest"
import {
  BEHAVIOR_FIELD_PATHS,
  createDerivedProfileDocument,
  createProfileDocument,
  detachProfileDocument,
  duplicateProfileDocument,
  materializeProfileDocument,
  parseProfileDocument,
  profileDependsOn,
  resetProfileInheritance,
  resolveProfileDocument,
  serializeProfileDocument,
  updateProfileBehavior,
  updateProfileDocument
} from "./profile"
import type { BehaviorProfile } from "./types"

const profile: BehaviorProfile = {
  role: "Research engineer",
  objective: "Investigate technical questions using primary evidence.",
  purpose: "research",
  customRules: ["Never invent source content."],
  communication: {
    naturalness: 80,
    directness: 82,
    formality: 55,
    humor: 0,
    verbosity: "medium"
  },
  reasoning: {
    initiative: 82,
    verification: 100,
    uncertaintyHandling: "strict"
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
  it("creates a stable schema v4 root document", () => {
    const document = createProfileDocument({
      id: "research",
      name: "Research",
      profile,
      now: "2026-09-30T12:00:00.000Z"
    })

    expect(document.schemaVersion).toBe(4)
    expect(document.id).toBe("research")
    expect(document.baseProfileId).toBeNull()
    expect(document.inheritedFields).toEqual([])
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

  it("creates a live derived profile whose inherited fields follow the base", () => {
    const base = createProfileDocument({
      id: "base",
      name: "Base",
      profile,
      now: "2026-09-30T12:00:00.000Z"
    })
    const child = createDerivedProfileDocument(base, [base], {
      name: "Child",
      now: "2026-09-30T12:10:00.000Z"
    })
    const changedBase = updateProfileDocument(base, {
      profile: {
        ...base.profile,
        communication: {
          ...base.profile.communication,
          directness: 25
        }
      }
    })

    const resolved = resolveProfileDocument(child, [changedBase, child])

    expect(child.baseProfileId).toBe("base")
    expect(child.inheritedFields).toHaveLength(BEHAVIOR_FIELD_PATHS.length)
    expect(resolved.communication.directness).toBe(25)
  })

  it("inherits hard rules until the child overrides them", () => {
    const base = createProfileDocument({ id: "base", name: "Base", profile })
    const child = createDerivedProfileDocument(base, [base], { name: "Child" })
    const changedBase = updateProfileDocument(base, {
      profile: {
        ...base.profile,
        customRules: ["Never invent source content.", "Prefer reversible actions."]
      }
    })

    expect(resolveProfileDocument(child, [changedBase, child]).customRules).toEqual([
      "Never invent source content.",
      "Prefer reversible actions."
    ])

    const resolvedBefore = resolveProfileDocument(child, [changedBase, child])
    const overridden = updateProfileBehavior(child, resolvedBefore, {
      ...resolvedBefore,
      customRules: ["Child-only rule."]
    })

    expect(overridden.inheritedFields).not.toContain("customRules")
    expect(resolveProfileDocument(overridden, [changedBase, overridden]).customRules).toEqual([
      "Child-only rule."
    ])
  })

  it("turns only edited inherited fields into local overrides", () => {
    const base = createProfileDocument({
      id: "base",
      name: "Base",
      profile
    })
    const child = createDerivedProfileDocument(base, [base], { name: "Child" })
    const resolvedBefore = resolveProfileDocument(child, [base, child])
    const nextProfile: BehaviorProfile = {
      ...resolvedBefore,
      communication: {
        ...resolvedBefore.communication,
        directness: 44
      }
    }
    const updatedChild = updateProfileBehavior(child, resolvedBefore, nextProfile)
    const changedBase = updateProfileDocument(base, {
      profile: {
        ...base.profile,
        communication: {
          ...base.profile.communication,
          directness: 10,
          formality: 77
        }
      }
    })

    const resolved = resolveProfileDocument(updatedChild, [changedBase, updatedChild])

    expect(updatedChild.inheritedFields).not.toContain("communication.directness")
    expect(updatedChild.inheritedFields).toContain("communication.formality")
    expect(resolved.communication.directness).toBe(44)
    expect(resolved.communication.formality).toBe(77)
  })

  it("resets local overrides back to live inheritance", () => {
    const base = createProfileDocument({ id: "base", name: "Base", profile })
    const child = createDerivedProfileDocument(base, [base], { name: "Child" })
    const resolvedBefore = resolveProfileDocument(child, [base, child])
    const overridden = updateProfileBehavior(child, resolvedBefore, {
      ...resolvedBefore,
      role: "Local role"
    })

    const reset = resetProfileInheritance(overridden, [base, overridden])
    const resolved = resolveProfileDocument(reset, [base, reset])

    expect(reset.inheritedFields).toHaveLength(BEHAVIOR_FIELD_PATHS.length)
    expect(resolved.role).toBe(base.profile.role)
  })

  it("detaches a derived profile without changing its resolved behavior", () => {
    const base = createProfileDocument({ id: "base", name: "Base", profile })
    const child = createDerivedProfileDocument(base, [base], { name: "Child" })
    const changedBase = updateProfileDocument(base, {
      profile: {
        ...base.profile,
        reasoning: {
          ...base.profile.reasoning,
          initiative: 23
        }
      }
    })

    const before = resolveProfileDocument(child, [changedBase, child])
    const detached = detachProfileDocument(child, [changedBase, child])

    expect(detached.baseProfileId).toBeNull()
    expect(detached.inheritedFields).toEqual([])
    expect(detached.profile).toEqual(before)
  })

  it("duplicates as an independent materialized profile", () => {
    const base = createProfileDocument({ id: "base", name: "Base", profile })
    const child = createDerivedProfileDocument(base, [base], { name: "Child" })
    const duplicate = duplicateProfileDocument(child, {
      name: "Independent",
      documents: [base, child]
    })

    expect(duplicate.id).not.toBe(child.id)
    expect(duplicate.baseProfileId).toBeNull()
    expect(duplicate.profile).toEqual(resolveProfileDocument(child, [base, child]))
  })

  it("materializes a derived profile for portable export", () => {
    const base = createProfileDocument({ id: "base", name: "Base", profile })
    const child = createDerivedProfileDocument(base, [base], { name: "Child" })
    const portable = materializeProfileDocument(child, [base, child])

    expect(portable.baseProfileId).toBeNull()
    expect(portable.inheritedFields).toEqual([])
    expect(parseProfileDocument(serializeProfileDocument(portable))).toEqual(portable)
  })

  it("detects transitive dependencies", () => {
    const base = createProfileDocument({ id: "base", name: "Base", profile })
    const child = createDerivedProfileDocument(base, [base], { name: "Child" })
    const grandchild = createDerivedProfileDocument(child, [base, child], {
      name: "Grandchild"
    })

    expect(profileDependsOn(grandchild, "base", [base, child, grandchild])).toBe(true)
    expect(profileDependsOn(base, "base", [base, child, grandchild])).toBe(false)
  })

  it("throws on inheritance cycles instead of recursing forever", () => {
    const base = createProfileDocument({ id: "base", name: "Base", profile })
    const child = createProfileDocument({
      id: "child",
      name: "Child",
      profile,
      baseProfileId: "base"
    })
    const cyclicBase = updateProfileDocument(base, {
      baseProfileId: "child",
      inheritedFields: [...BEHAVIOR_FIELD_PATHS]
    })

    expect(() => resolveProfileDocument(cyclicBase, [cyclicBase, child])).toThrow(
      "Profile inheritance cycle"
    )
  })

  it("preserves metadata updates", () => {
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

  it("migrates schema v3 inheritance into v4", () => {
    const { customRules: _customRules, ...legacyProfile } = profile
    const legacy = JSON.stringify({
      schemaVersion: 3,
      id: "legacy-child",
      name: "Legacy child",
      description: "",
      profile: legacyProfile,
      baseProfileId: "base",
      inheritedFields: ["role", "communication.directness"],
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z"
    })

    const migrated = parseProfileDocument(legacy)

    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.baseProfileId).toBe("base")
    expect(migrated.inheritedFields).toContain("customRules")
    expect(migrated.profile.customRules).toEqual([])
  })

  it("migrates schema v2 profiles to independent v4 roots", () => {
    const legacy = JSON.stringify({
      schemaVersion: 2,
      id: "legacy-v2",
      name: "Legacy v2",
      description: "",
      profile: (({ customRules: _customRules, ...legacyProfile }) => legacyProfile)(profile),
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z"
    })

    const migrated = parseProfileDocument(legacy)

    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.baseProfileId).toBeNull()
    expect(migrated.inheritedFields).toEqual([])
    expect(migrated.updatedAt).toBe("2026-09-02T00:00:00.000Z")
  })

  it("migrates schema v1 profiles without losing original behavior", () => {
    const legacy = JSON.stringify({
      schemaVersion: 1,
      id: "legacy",
      name: "Legacy",
      description: "",
      profile: {
        role: "Engineer",
        objective: "Build reliable software.",
        purpose: "engineering",
        communication: {
          naturalness: 80,
          directness: 90,
          verbosity: "low"
        },
        research: {
          rigor: 80,
          preferPrimarySources: true,
          allowCommunitySources: true
        },
        writing: {
          avoidAISlop: true,
          avoidUnnecessaryHeadings: true,
          avoidRestatingPrompt: true
        }
      },
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z"
    })

    const migrated = parseProfileDocument(legacy)

    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.profile.communication.directness).toBe(90)
    expect(migrated.profile.communication.formality).toBe(45)
    expect(migrated.profile.reasoning.verification).toBe(85)
    expect(migrated.profile.customRules).toEqual([])
    expect(migrated.updatedAt).toBe("2026-09-02T00:00:00.000Z")
  })

  it("rejects malformed imports", () => {
    expect(() => parseProfileDocument('{"schemaVersion":3}')).toThrow(
      "Profile file is invalid or incomplete."
    )
  })
})
