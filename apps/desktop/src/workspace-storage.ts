import {
  createWorkspaceDocument,
  parseWorkspaceDocument,
  serializeWorkspaceDocument,
  type WorkspaceDocument
} from "@humanizer/core"
import {
  loadConversationSessions,
  saveConversationSessions
} from "./conversation-storage"
import {
  loadActiveProfileId,
  loadProfiles,
  saveActiveProfileId,
  saveProfiles
} from "./profile-storage"
import {
  loadActivePromptDraftId,
  loadPromptDrafts,
  saveActivePromptDraftId,
  savePromptDrafts
} from "./prompt-draft-storage"
import {
  loadProjects,
  saveProjects
} from "./project-storage"

function requireAvailable(name: string, available: boolean): void {
  if (!available) {
    throw new Error(
      name + " storage is unavailable. The workspace cannot be backed up or replaced safely."
    )
  }
}

export function createLocalWorkspaceBackup(): WorkspaceDocument {
  const profileStore = loadProfiles()
  const projectStore = loadProjects()
  const draftStore = loadPromptDrafts()

  requireAvailable("Profile", profileStore.storageAvailable)
  requireAvailable("Project", projectStore.storageAvailable)
  requireAvailable("Prompt draft", draftStore.storageAvailable)

  const activeProfile = loadActiveProfileId()
  const activeDraft = loadActivePromptDraftId()
  const activeProfileId = profileStore.profiles.some(
    (profile) => profile.id === activeProfile
  )
    ? activeProfile
    : null
  const activeDraftId = draftStore.drafts.some(
    (draft) => draft.id === activeDraft
  )
    ? activeDraft
    : null

  return createWorkspaceDocument({
    profiles: profileStore.profiles,
    projects: projectStore.projects,
    drafts: draftStore.drafts,
    activeProfileId,
    activeDraftId
  })
}

export function downloadWorkspaceBackup(document: WorkspaceDocument): void {
  const text = serializeWorkspaceDocument(document)
  const blob = new Blob([text], {
    type: "application/json;charset=utf-8"
  })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement("a")
  const stamp = document.exportedAt
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "")

  anchor.href = url
  anchor.download = "humanizer-workspace-" + stamp + ".json"
  anchor.click()
  URL.revokeObjectURL(url)
}

export function parseWorkspaceBackup(serialized: string): WorkspaceDocument {
  return parseWorkspaceDocument(serialized)
}

export function replaceLocalWorkspace(document: WorkspaceDocument): void {
  const validated = parseWorkspaceDocument(serializeWorkspaceDocument(document))
  const previousProfiles = loadProfiles()
  const previousProjects = loadProjects()
  const previousDrafts = loadPromptDrafts()
  const previousConversations = loadConversationSessions()
  const previousActiveProfileId = loadActiveProfileId()
  const previousActiveDraftId = loadActivePromptDraftId()

  requireAvailable("Profile", previousProfiles.storageAvailable)
  requireAvailable("Project", previousProjects.storageAvailable)
  requireAvailable("Prompt draft", previousDrafts.storageAvailable)
  requireAvailable("Conversation", previousConversations.storageAvailable)

  const writes = [
    saveProfiles(validated.profiles),
    saveProjects(validated.projects),
    savePromptDrafts(validated.drafts),
    saveActiveProfileId(validated.activeProfileId),
    saveActivePromptDraftId(validated.activeDraftId),
    saveConversationSessions([])
  ]

  if (writes.every(Boolean)) {
    return
  }

  const rollback = [
    saveProfiles(previousProfiles.profiles),
    saveProjects(previousProjects.projects),
    savePromptDrafts(previousDrafts.drafts),
    saveActiveProfileId(previousActiveProfileId),
    saveActivePromptDraftId(previousActiveDraftId),
    saveConversationSessions(previousConversations.sessions)
  ]

  if (!rollback.every(Boolean)) {
    throw new Error(
      "Workspace restore failed and the previous local state could not be fully restored."
    )
  }

  throw new Error(
    "Workspace restore failed. The previous local state was restored."
  )
}
