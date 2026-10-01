import {
  parsePromptDraftDocument,
  type PromptDraftDocument
} from "./draft"
import {
  parseProfileDocument,
  resolveProfileDocument,
  type ProfileDocument
} from "./profile"
import {
  parseProjectDocument,
  type ProjectDocument
} from "./project"

export const WORKSPACE_SCHEMA_VERSION = 1 as const

export interface WorkspaceDocument {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION
  exportedAt: string
  activeProfileId: string | null
  activeDraftId: string | null
  profiles: ProfileDocument[]
  projects: ProjectDocument[]
  drafts: PromptDraftDocument[]
}

export interface CreateWorkspaceInput {
  profiles: readonly ProfileDocument[]
  projects: readonly ProjectDocument[]
  drafts: readonly PromptDraftDocument[]
  activeProfileId?: string | null
  activeDraftId?: string | null
  exportedAt?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseDocumentArray<T>(
  value: unknown,
  parse: (serialized: string) => T,
  label: string
): T[] {
  if (!Array.isArray(value)) {
    throw new Error("Workspace " + label + " must be an array.")
  }

  return value.map((entry, index) => {
    try {
      return parse(JSON.stringify(entry))
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Invalid document."
      throw new Error(
        "Workspace " + label + "[" + index + "] is invalid: " + message
      )
    }
  })
}

function assertUniqueIds(
  values: readonly { id: string }[],
  label: string
): void {
  const seen = new Set<string>()

  for (const value of values) {
    if (seen.has(value.id)) {
      throw new Error("Workspace contains duplicate " + label + " id: " + value.id)
    }

    seen.add(value.id)
  }
}

function assertProfileGraph(profiles: readonly ProfileDocument[]): void {
  const ids = new Set(profiles.map((profile) => profile.id))

  for (const profile of profiles) {
    if (
      profile.baseProfileId !== null &&
      !ids.has(profile.baseProfileId)
    ) {
      throw new Error(
        "Workspace profile " +
          profile.id +
          " references missing base profile " +
          profile.baseProfileId +
          "."
      )
    }

    try {
      resolveProfileDocument(profile, profiles)
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Invalid profile graph."
      throw new Error(
        "Workspace profile graph is invalid: " + message
      )
    }
  }
}

function assertReferences(
  profiles: readonly ProfileDocument[],
  projects: readonly ProjectDocument[],
  drafts: readonly PromptDraftDocument[],
  activeProfileId: string | null,
  activeDraftId: string | null
): void {
  const profileIds = new Set(profiles.map((profile) => profile.id))
  const projectIds = new Set(projects.map((project) => project.id))
  const draftIds = new Set(drafts.map((draft) => draft.id))

  for (const draft of drafts) {
    if (!profileIds.has(draft.profileId)) {
      throw new Error(
        "Workspace draft " +
          draft.id +
          " references missing profile " +
          draft.profileId +
          "."
      )
    }

    if (
      draft.projectId !== null &&
      !projectIds.has(draft.projectId)
    ) {
      throw new Error(
        "Workspace draft " +
          draft.id +
          " references missing project " +
          draft.projectId +
          "."
      )
    }
  }

  if (
    activeProfileId !== null &&
    !profileIds.has(activeProfileId)
  ) {
    throw new Error(
      "Workspace active profile does not exist: " + activeProfileId
    )
  }

  if (
    activeDraftId !== null &&
    !draftIds.has(activeDraftId)
  ) {
    throw new Error(
      "Workspace active draft does not exist: " + activeDraftId
    )
  }
}

function validateWorkspace(
  document: WorkspaceDocument
): WorkspaceDocument {
  if (document.profiles.length === 0) {
    throw new Error("Workspace must contain at least one profile.")
  }

  assertUniqueIds(document.profiles, "profile")
  assertUniqueIds(document.projects, "project")
  assertUniqueIds(document.drafts, "draft")
  assertProfileGraph(document.profiles)
  assertReferences(
    document.profiles,
    document.projects,
    document.drafts,
    document.activeProfileId,
    document.activeDraftId
  )

  return document
}

export function createWorkspaceDocument(
  input: CreateWorkspaceInput
): WorkspaceDocument {
  const activeProfileId = input.activeProfileId ?? null
  const activeDraftId = input.activeDraftId ?? null

  return validateWorkspace({
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    activeProfileId,
    activeDraftId,
    profiles: input.profiles.map((profile) => structuredClone(profile)),
    projects: input.projects.map((project) => structuredClone(project)),
    drafts: input.drafts.map((draft) => structuredClone(draft))
  })
}

export function serializeWorkspaceDocument(
  document: WorkspaceDocument
): string {
  validateWorkspace(document)
  return JSON.stringify(document, null, 2) + "\n"
}

export function parseWorkspaceDocument(
  serialized: string
): WorkspaceDocument {
  const value: unknown = JSON.parse(serialized)

  if (!isRecord(value)) {
    throw new Error("Workspace file must contain an object.")
  }

  if (value.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    throw new Error("Unsupported workspace schema version.")
  }

  if (
    typeof value.exportedAt !== "string" ||
    Number.isNaN(Date.parse(value.exportedAt)) ||
    !(
      value.activeProfileId === null ||
      typeof value.activeProfileId === "string"
    ) ||
    !(
      value.activeDraftId === null ||
      typeof value.activeDraftId === "string"
    )
  ) {
    throw new Error("Workspace file is invalid or incomplete.")
  }

  const document: WorkspaceDocument = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: value.exportedAt,
    activeProfileId: value.activeProfileId as string | null,
    activeDraftId: value.activeDraftId as string | null,
    profiles: parseDocumentArray(
      value.profiles,
      parseProfileDocument,
      "profiles"
    ),
    projects: parseDocumentArray(
      value.projects,
      parseProjectDocument,
      "projects"
    ),
    drafts: parseDocumentArray(
      value.drafts,
      parsePromptDraftDocument,
      "drafts"
    )
  }

  return validateWorkspace(document)
}
