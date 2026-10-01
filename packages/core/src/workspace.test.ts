import { describe, expect, it } from "vitest"
import { createPromptDraftDocument } from "./draft"
import {
  createDerivedProfileDocument,
  createProfileDocument
} from "./profile"
import { createProjectDocument } from "./project"
import type { BehaviorProfile } from "./types"
import {
  createWorkspaceDocument,
  parseWorkspaceDocument,
  serializeWorkspaceDocument
} from "./workspace"

const behavior: BehaviorProfile = {
  role: "Principal engineer",
  objective: "Ship reliable software.",
  purpose: "engineering",
  customRules: ["Use documented APIs."],
  communication: {
    naturalness: 80,
    directness: 85,
    formality: 40,
    humor: 5,
    verbosity: "medium"
  },
  reasoning: {
    initiative: 85,
    verification: 95,
    uncertaintyHandling: "explicit"
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

function fixture() {
  const base = createProfileDocument({
    id: "base",
    name: "Base",
    profile: behavior,
    now: "2026-10-01T00:00:00.000Z"
  })
  const derived = createDerivedProfileDocument(
    base,
    [base],
    {
      name: "Derived",
      now: "2026-10-01T00:00:00.000Z"
    }
  )
  const project = createProjectDocument({
    id: "payments",
    name: "Payments",
    behaviorOverrides: {
      "research.rigor": 100
    },
    now: "2026-10-01T00:00:00.000Z"
  })
  const draft = createPromptDraftDocument({
    id: "review",
    name: "Review",
    profileId: derived.id,
    projectId: project.id,
    target: {
      surfaceId: "openai-api-developer",
      modelId: "gpt-5.6-sol"
    },
    now: "2026-10-01T00:00:00.000Z"
  })

  return { base, derived, project, draft }
}

describe("workspace bundles", () => {
  it("round-trips a complete validated workspace", () => {
    const { base, derived, project, draft } = fixture()
    const workspace = createWorkspaceDocument({
      profiles: [base, derived],
      projects: [project],
      drafts: [draft],
      activeProfileId: derived.id,
      activeDraftId: draft.id,
      exportedAt: "2026-10-01T12:00:00.000Z"
    })

    expect(parseWorkspaceDocument(serializeWorkspaceDocument(workspace))).toEqual(
      workspace
    )
  })

  it("rejects duplicate document ids", () => {
    const { base } = fixture()

    expect(() =>
      createWorkspaceDocument({
        profiles: [base, structuredClone(base)],
        projects: [],
        drafts: []
      })
    ).toThrow("duplicate profile id")
  })

  it("rejects a derived profile whose base is missing", () => {
    const { derived } = fixture()

    expect(() =>
      createWorkspaceDocument({
        profiles: [derived],
        projects: [],
        drafts: []
      })
    ).toThrow("references missing base profile")
  })

  it("rejects dangling draft profile and project references", () => {
    const { base, project, draft } = fixture()

    expect(() =>
      createWorkspaceDocument({
        profiles: [base],
        projects: [project],
        drafts: [draft]
      })
    ).toThrow("references missing profile")

    expect(() =>
      createWorkspaceDocument({
        profiles: [base],
        projects: [],
        drafts: [
          {
            ...draft,
            profileId: base.id
          }
        ]
      })
    ).toThrow("references missing project")
  })

  it("rejects missing active ids", () => {
    const { base } = fixture()

    expect(() =>
      createWorkspaceDocument({
        profiles: [base],
        projects: [],
        drafts: [],
        activeProfileId: "missing"
      })
    ).toThrow("active profile does not exist")

    expect(() =>
      createWorkspaceDocument({
        profiles: [base],
        projects: [],
        drafts: [],
        activeDraftId: "missing"
      })
    ).toThrow("active draft does not exist")
  })

  it("rejects malformed embedded documents during import", () => {
    const { base } = fixture()
    const serialized = JSON.stringify({
      schemaVersion: 1,
      exportedAt: "2026-10-01T12:00:00.000Z",
      activeProfileId: base.id,
      activeDraftId: null,
      profiles: [
        {
          ...base,
          profile: {
            ...base.profile,
            tools: {
              ...base.profile.tools,
              usage: "sometimes"
            }
          }
        }
      ],
      projects: [],
      drafts: []
    })

    expect(() => parseWorkspaceDocument(serialized)).toThrow(
      "Workspace profiles[0] is invalid"
    )
  })
})
