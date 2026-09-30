import type { BehaviorProfile } from "./types"

export const PROFILE_SCHEMA_VERSION = 1 as const

export interface ProfileDocument {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION
  id: string
  name: string
  description: string
  profile: BehaviorProfile
  createdAt: string
  updatedAt: string
}

export interface CreateProfileInput {
  id?: string
  name: string
  description?: string
  profile: BehaviorProfile
  now?: string
}

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  return "profile-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isBehaviorProfile(value: unknown): value is BehaviorProfile {
  if (!isRecord(value)) {
    return false
  }

  const communication = value.communication
  const research = value.research
  const writing = value.writing

  return (
    typeof value.role === "string" &&
    typeof value.objective === "string" &&
    ["general", "engineering", "research", "writing", "agent"].includes(String(value.purpose)) &&
    isRecord(communication) &&
    isNumber(communication.naturalness) &&
    isNumber(communication.directness) &&
    ["low", "medium", "high"].includes(String(communication.verbosity)) &&
    isRecord(research) &&
    isNumber(research.rigor) &&
    typeof research.preferPrimarySources === "boolean" &&
    typeof research.allowCommunitySources === "boolean" &&
    isRecord(writing) &&
    typeof writing.avoidAISlop === "boolean" &&
    typeof writing.avoidUnnecessaryHeadings === "boolean" &&
    typeof writing.avoidRestatingPrompt === "boolean"
  )
}

export function createProfileDocument(input: CreateProfileInput): ProfileDocument {
  const now = input.now ?? new Date().toISOString()

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: input.id ?? createId(),
    name: input.name.trim() || "Untitled profile",
    description: input.description?.trim() ?? "",
    profile: structuredClone(input.profile),
    createdAt: now,
    updatedAt: now
  }
}

export function duplicateProfileDocument(
  source: ProfileDocument,
  options: { name?: string; now?: string } = {}
): ProfileDocument {
  return createProfileDocument({
    name: options.name?.trim() || source.name + " Copy",
    description: source.description,
    profile: source.profile,
    ...(options.now ? { now: options.now } : {})
  })
}

export function updateProfileDocument(
  source: ProfileDocument,
  changes: Partial<Pick<ProfileDocument, "name" | "description" | "profile">>,
  now = new Date().toISOString()
): ProfileDocument {
  return {
    ...source,
    ...changes,
    name: changes.name?.trim() || source.name,
    description:
      changes.description === undefined ? source.description : changes.description.trim(),
    profile: changes.profile ? structuredClone(changes.profile) : source.profile,
    updatedAt: now
  }
}

export function serializeProfileDocument(document: ProfileDocument): string {
  return JSON.stringify(document, null, 2) + "\n"
}

export function parseProfileDocument(serialized: string): ProfileDocument {
  const value: unknown = JSON.parse(serialized)

  if (!isRecord(value)) {
    throw new Error("Profile file must contain an object.")
  }

  if (value.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    throw new Error("Unsupported profile schema version.")
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isBehaviorProfile(value.profile)
  ) {
    throw new Error("Profile file is invalid or incomplete.")
  }

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: value.id,
    name: value.name,
    description: value.description,
    profile: structuredClone(value.profile),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
}
