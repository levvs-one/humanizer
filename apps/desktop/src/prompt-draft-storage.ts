import {
  parsePromptDraftDocument,
  serializePromptDraftDocument,
  type PromptDraftDocument
} from "@humanizer/core"

const DRAFTS_KEY = "humanizer.prompt-drafts.v1"
const ACTIVE_DRAFT_KEY = "humanizer.active-prompt-draft.v1"

export function loadPromptDrafts(): PromptDraftDocument[] {
  const serialized = window.localStorage.getItem(DRAFTS_KEY)

  if (!serialized) {
    return []
  }

  try {
    const values: unknown = JSON.parse(serialized)

    if (!Array.isArray(values)) {
      return []
    }

    return values.flatMap((value) => {
      try {
        return [parsePromptDraftDocument(JSON.stringify(value))]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

export function savePromptDrafts(
  drafts: readonly PromptDraftDocument[]
): void {
  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
}

export function loadActivePromptDraftId(): string | null {
  return window.localStorage.getItem(ACTIVE_DRAFT_KEY)
}

export function saveActivePromptDraftId(draftId: string): void {
  window.localStorage.setItem(ACTIVE_DRAFT_KEY, draftId)
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

export function downloadCompiledPrompt(name: string, text: string): void {
  downloadText(
    safeFilename(name) + ".txt",
    text.endsWith("\n") ? text : text + "\n",
    "text/plain;charset=utf-8"
  )
}
