import type { PlanId, PromptBrief, PromptTarget } from "./types"

export const PROMPT_DRAFT_SCHEMA_VERSION = 1 as const

export interface PromptDraftDocument {
  schemaVersion: typeof PROMPT_DRAFT_SCHEMA_VERSION
  id: string
  name: string
  profileId: string
  target: PromptTarget
  brief: PromptBrief
  createdAt: string
  updatedAt: string
}

export interface CreatePromptDraftInput {
  id?: string
  name?: string
  profileId: string
  target: PromptTarget
  brief?: PromptBrief
  now?: string
}

const EMPTY_BRIEF: PromptBrief = {
  goal: "",
  context: "",
  output: "",
  constraints: ""
}

const PLAN_IDS: readonly PlanId[] = [
  "free",
  "go",
  "plus",
  "pro",
  "business",
  "enterprise",
  "education"
]

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  return "draft-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPromptBrief(value: unknown): value is PromptBrief {
  if (!isRecord(value)) return false

  return (
    typeof value.goal === "string" &&
    typeof value.context === "string" &&
    typeof value.output === "string" &&
    typeof value.constraints === "string"
  )
}

function isPromptTarget(value: unknown): value is PromptTarget {
  if (!isRecord(value) || typeof value.surfaceId !== "string") {
    return false
  }

  if (value.modelId !== undefined && typeof value.modelId !== "string") {
    return false
  }

  if (
    value.plan !== undefined &&
    (!PLAN_IDS.includes(value.plan as PlanId) || typeof value.plan !== "string")
  ) {
    return false
  }

  return true
}

export function createPromptDraftDocument(
  input: CreatePromptDraftInput
): PromptDraftDocument {
  const now = input.now ?? new Date().toISOString()

  return {
    schemaVersion: PROMPT_DRAFT_SCHEMA_VERSION,
    id: input.id ?? createId(),
    name: input.name?.trim() || "Untitled Prompt",
    profileId: input.profileId,
    target: structuredClone(input.target),
    brief: structuredClone(input.brief ?? EMPTY_BRIEF),
    createdAt: now,
    updatedAt: now
  }
}

export function updatePromptDraftDocument(
  source: PromptDraftDocument,
  changes: Partial<
    Pick<PromptDraftDocument, "name" | "profileId" | "target" | "brief">
  >,
  now = new Date().toISOString()
): PromptDraftDocument {
  return {
    ...source,
    ...changes,
    name: changes.name === undefined ? source.name : changes.name,
    profileId: changes.profileId ?? source.profileId,
    target: changes.target ? structuredClone(changes.target) : source.target,
    brief: changes.brief ? structuredClone(changes.brief) : source.brief,
    updatedAt: now
  }
}

export function duplicatePromptDraftDocument(
  source: PromptDraftDocument,
  options: { name?: string; now?: string } = {}
): PromptDraftDocument {
  return createPromptDraftDocument({
    name: options.name?.trim() || source.name + " Copy",
    profileId: source.profileId,
    target: source.target,
    brief: source.brief,
    ...(options.now ? { now: options.now } : {})
  })
}

export function serializePromptDraftDocument(
  document: PromptDraftDocument
): string {
  return JSON.stringify(document, null, 2) + "\n"
}

export function parsePromptDraftDocument(
  serialized: string
): PromptDraftDocument {
  const value: unknown = JSON.parse(serialized)

  if (!isRecord(value)) {
    throw new Error("Prompt draft file must contain an object.")
  }

  if (value.schemaVersion !== PROMPT_DRAFT_SCHEMA_VERSION) {
    throw new Error("Unsupported prompt draft schema version.")
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.profileId !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isPromptTarget(value.target) ||
    !isPromptBrief(value.brief)
  ) {
    throw new Error("Prompt draft file is invalid or incomplete.")
  }

  return {
    schemaVersion: PROMPT_DRAFT_SCHEMA_VERSION,
    id: value.id,
    name: value.name,
    profileId: value.profileId,
    target: structuredClone(value.target),
    brief: structuredClone(value.brief),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
}
