import {
  parsePromptDraftDocument,
  serializePromptDraftDocument,
  type PromptDraftDocument,
  type TargetExportArtifact
} from "@humanizer/core"

const DRAFTS_KEY = "humanizer.prompt-drafts.v1"
const ACTIVE_DRAFT_KEY = "humanizer.active-prompt-draft.v1"

export interface LoadedPromptDrafts {
  drafts: PromptDraftDocument[]
  storageAvailable: boolean
}

export function loadPromptDrafts(): LoadedPromptDrafts {
  let serialized: string | null

  try {
    serialized = window.localStorage.getItem(DRAFTS_KEY)
  } catch {
    return { drafts: [], storageAvailable: false }
  }

  if (!serialized) {
    return { drafts: [], storageAvailable: true }
  }

  try {
    const values: unknown = JSON.parse(serialized)

    if (!Array.isArray(values)) {
      return { drafts: [], storageAvailable: true }
    }

    return {
      drafts: values.flatMap((value) => {
        try {
          return [parsePromptDraftDocument(JSON.stringify(value))]
        } catch {
          return []
        }
      }),
      storageAvailable: true
    }
  } catch {
    return { drafts: [], storageAvailable: true }
  }
}

export function savePromptDrafts(
  drafts: readonly PromptDraftDocument[]
): boolean {
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
    return true
  } catch {
    return false
  }
}

export function loadActivePromptDraftId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_DRAFT_KEY)
  } catch {
    return null
  }
}

export function saveActivePromptDraftId(draftId: string | null): boolean {
  try {
    if (draftId === null) {
      window.localStorage.removeItem(ACTIVE_DRAFT_KEY)
    } else {
      window.localStorage.setItem(ACTIVE_DRAFT_KEY, draftId)
    }
    return true
  } catch {
    return false
  }
}

function safeFilename(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return normalized || "prompt"
}

function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadPromptDraft(draft: PromptDraftDocument): void {
  downloadText(
    safeFilename(draft.name) + ".humanizer-prompt.json",
    serializePromptDraftDocument(draft),
    "application/json;charset=utf-8"
  )
}

export function downloadCompiledPrompt(
  name: string,
  artifact: TargetExportArtifact
): void {
  downloadText(
    safeFilename(name) + "." + artifact.extension,
    artifact.content,
    artifact.mediaType
  )
}
