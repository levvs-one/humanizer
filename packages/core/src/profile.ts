import type {
  BehaviorProfile,
  UncertaintyHandling
} from "./types"

export const PROFILE_SCHEMA_VERSION = 2 as const

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

interface LegacyBehaviorProfileV1 {
  role: string
  objective: string
  purpose: BehaviorProfile["purpose"]
  communication: {
    naturalness: number
    directness: number
    verbosity: BehaviorProfile["communication"]["verbosity"]
  }
  research: BehaviorProfile["research"]
  writing: BehaviorProfile["writing"]
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

function isPurpose(value: unknown): value is BehaviorProfile["purpose"] {
  return ["general", "engineering", "research", "writing", "agent"].includes(String(value))
}

function isVerbosity(
  value: unknown
): value is BehaviorProfile["communication"]["verbosity"] {
  return ["low", "medium", "high"].includes(String(value))
}

function isUncertaintyHandling(value: unknown): value is UncertaintyHandling {
  return ["quiet", "explicit", "strict"].includes(String(value))
}

function hasResearch(value: unknown): value is BehaviorProfile["research"] {
  if (!isRecord(value)) return false

  return (
    isNumber(value.rigor) &&
    typeof value.preferPrimarySources === "boolean" &&
    typeof value.allowCommunitySources === "boolean"
  )
}

function hasWriting(value: unknown): value is BehaviorProfile["writing"] {
  if (!isRecord(value)) return false

  return (
    typeof value.avoidAISlop === "boolean" &&
    typeof value.avoidUnnecessaryHeadings === "boolean" &&
    typeof value.avoidRestatingPrompt === "boolean"
  )
}

function isBehaviorProfileV2(value: unknown): value is BehaviorProfile {
  if (!isRecord(value)) return false

  const communication = value.communication
  const reasoning = value.reasoning

  return (
    typeof value.role === "string" &&
    typeof value.objective === "string" &&
    isPurpose(value.purpose) &&
    isRecord(communication) &&
    isNumber(communication.naturalness) &&
    isNumber(communication.directness) &&
    isNumber(communication.formality) &&
    isNumber(communication.humor) &&
    isVerbosity(communication.verbosity) &&
    isRecord(reasoning) &&
    isNumber(reasoning.initiative) &&
    isNumber(reasoning.verification) &&
    isUncertaintyHandling(reasoning.uncertaintyHandling) &&
    hasResearch(value.research) &&
    hasWriting(value.writing)
  )
}

function isLegacyBehaviorProfileV1(
  value: unknown
): value is LegacyBehaviorProfileV1 {
  if (!isRecord(value)) return false

  const communication = value.communication

  return (
    typeof value.role === "string" &&
    typeof value.objective === "string" &&
    isPurpose(value.purpose) &&
    isRecord(communication) &&
    isNumber(communication.naturalness) &&
    isNumber(communication.directness) &&
    isVerbosity(communication.verbosity) &&
    hasResearch(value.research) &&
    hasWriting(value.writing)
  )
}

function migrateProfileV1(profile: LegacyBehaviorProfileV1): BehaviorProfile {
  return {
    role: profile.role,
    objective: profile.objective,
    purpose: profile.purpose,
    communication: {
      naturalness: profile.communication.naturalness,
      directness: profile.communication.directness,
      formality: 45,
      humor: 10,
      verbosity: profile.communication.verbosity
    },
    reasoning: {
      initiative: 75,
      verification: 85,
      uncertaintyHandling: "explicit"
    },
    research: structuredClone(profile.research),
    writing: structuredClone(profile.writing)
  }
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

  const hasDocumentFields =
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"

  if (!hasDocumentFields) {
    throw new Error("Profile file is invalid or incomplete.")
  }

  if (value.schemaVersion === PROFILE_SCHEMA_VERSION && isBehaviorProfileV2(value.profile)) {
    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id: value.id as string,
      name: value.name as string,
      description: value.description as string,
      profile: structuredClone(value.profile),
      createdAt: value.createdAt as string,
      updatedAt: value.updatedAt as string
    }
  }

  if (value.schemaVersion === 1 && isLegacyBehaviorProfileV1(value.profile)) {
    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id: value.id as string,
      name: value.name as string,
      description: value.description as string,
      profile: migrateProfileV1(value.profile),
      createdAt: value.createdAt as string,
      updatedAt: value.updatedAt as string
    }
  }

  if (value.schemaVersion !== 1 && value.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    throw new Error("Unsupported profile schema version.")
  }

  throw new Error("Profile file is invalid or incomplete.")
}
