import type {
  BehaviorProfile,
  UncertaintyHandling
} from "./types"

export const PROFILE_SCHEMA_VERSION = 3 as const

export const BEHAVIOR_FIELD_PATHS = [
  "role",
  "objective",
  "purpose",
  "communication.naturalness",
  "communication.directness",
  "communication.formality",
  "communication.humor",
  "communication.verbosity",
  "reasoning.initiative",
  "reasoning.verification",
  "reasoning.uncertaintyHandling",
  "research.rigor",
  "research.preferPrimarySources",
  "research.allowCommunitySources",
  "writing.avoidAISlop",
  "writing.avoidUnnecessaryHeadings",
  "writing.avoidRestatingPrompt"
] as const

export type BehaviorFieldPath = (typeof BEHAVIOR_FIELD_PATHS)[number]

export interface ProfileDocument {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION
  id: string
  name: string
  description: string
  profile: BehaviorProfile
  baseProfileId: string | null
  inheritedFields: BehaviorFieldPath[]
  createdAt: string
  updatedAt: string
}

export interface CreateProfileInput {
  id?: string
  name: string
  description?: string
  profile: BehaviorProfile
  baseProfileId?: string | null
  inheritedFields?: BehaviorFieldPath[]
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

function isBehaviorFieldPath(value: unknown): value is BehaviorFieldPath {
  return (
    typeof value === "string" &&
    (BEHAVIOR_FIELD_PATHS as readonly string[]).includes(value)
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

function fieldValue(profile: BehaviorProfile, path: BehaviorFieldPath): unknown {
  switch (path) {
    case "role": return profile.role
    case "objective": return profile.objective
    case "purpose": return profile.purpose
    case "communication.naturalness": return profile.communication.naturalness
    case "communication.directness": return profile.communication.directness
    case "communication.formality": return profile.communication.formality
    case "communication.humor": return profile.communication.humor
    case "communication.verbosity": return profile.communication.verbosity
    case "reasoning.initiative": return profile.reasoning.initiative
    case "reasoning.verification": return profile.reasoning.verification
    case "reasoning.uncertaintyHandling": return profile.reasoning.uncertaintyHandling
    case "research.rigor": return profile.research.rigor
    case "research.preferPrimarySources": return profile.research.preferPrimarySources
    case "research.allowCommunitySources": return profile.research.allowCommunitySources
    case "writing.avoidAISlop": return profile.writing.avoidAISlop
    case "writing.avoidUnnecessaryHeadings": return profile.writing.avoidUnnecessaryHeadings
    case "writing.avoidRestatingPrompt": return profile.writing.avoidRestatingPrompt
  }
}

function inheritField(
  target: BehaviorProfile,
  base: BehaviorProfile,
  path: BehaviorFieldPath
): void {
  switch (path) {
    case "role": target.role = base.role; return
    case "objective": target.objective = base.objective; return
    case "purpose": target.purpose = base.purpose; return
    case "communication.naturalness": target.communication.naturalness = base.communication.naturalness; return
    case "communication.directness": target.communication.directness = base.communication.directness; return
    case "communication.formality": target.communication.formality = base.communication.formality; return
    case "communication.humor": target.communication.humor = base.communication.humor; return
    case "communication.verbosity": target.communication.verbosity = base.communication.verbosity; return
    case "reasoning.initiative": target.reasoning.initiative = base.reasoning.initiative; return
    case "reasoning.verification": target.reasoning.verification = base.reasoning.verification; return
    case "reasoning.uncertaintyHandling": target.reasoning.uncertaintyHandling = base.reasoning.uncertaintyHandling; return
    case "research.rigor": target.research.rigor = base.research.rigor; return
    case "research.preferPrimarySources": target.research.preferPrimarySources = base.research.preferPrimarySources; return
    case "research.allowCommunitySources": target.research.allowCommunitySources = base.research.allowCommunitySources; return
    case "writing.avoidAISlop": target.writing.avoidAISlop = base.writing.avoidAISlop; return
    case "writing.avoidUnnecessaryHeadings": target.writing.avoidUnnecessaryHeadings = base.writing.avoidUnnecessaryHeadings; return
    case "writing.avoidRestatingPrompt": target.writing.avoidRestatingPrompt = base.writing.avoidRestatingPrompt; return
  }
}

export function createProfileDocument(input: CreateProfileInput): ProfileDocument {
  const now = input.now ?? new Date().toISOString()
  const baseProfileId = input.baseProfileId ?? null

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: input.id ?? createId(),
    name: input.name.trim() || "Untitled profile",
    description: input.description?.trim() ?? "",
    profile: structuredClone(input.profile),
    baseProfileId,
    inheritedFields:
      baseProfileId === null
        ? []
        : [...new Set(input.inheritedFields ?? BEHAVIOR_FIELD_PATHS)],
    createdAt: now,
    updatedAt: now
  }
}

export function createDerivedProfileDocument(
  base: ProfileDocument,
  documents: readonly ProfileDocument[],
  options: { name?: string; description?: string; now?: string } = {}
): ProfileDocument {
  const resolved = resolveProfileDocument(base, documents)

  return createProfileDocument({
    name: options.name?.trim() || base.name + " Variant",
    description:
      options.description?.trim() ||
      "Inherits behavior from " + base.name + ".",
    profile: resolved,
    baseProfileId: base.id,
    inheritedFields: [...BEHAVIOR_FIELD_PATHS],
    ...(options.now ? { now: options.now } : {})
  })
}

export function duplicateProfileDocument(
  source: ProfileDocument,
  options: { name?: string; now?: string; documents?: readonly ProfileDocument[] } = {}
): ProfileDocument {
  const behavior = options.documents
    ? resolveProfileDocument(source, options.documents)
    : source.profile

  return createProfileDocument({
    name: options.name?.trim() || source.name + " Copy",
    description: source.description,
    profile: behavior,
    ...(options.now ? { now: options.now } : {})
  })
}

export function updateProfileDocument(
  source: ProfileDocument,
  changes: Partial<Pick<ProfileDocument, "name" | "description" | "profile" | "baseProfileId" | "inheritedFields">>,
  now = new Date().toISOString()
): ProfileDocument {
  const baseProfileId =
    changes.baseProfileId === undefined ? source.baseProfileId : changes.baseProfileId

  return {
    ...source,
    ...changes,
    name: changes.name?.trim() || source.name,
    description:
      changes.description === undefined ? source.description : changes.description.trim(),
    profile: changes.profile ? structuredClone(changes.profile) : source.profile,
    baseProfileId,
    inheritedFields:
      baseProfileId === null
        ? []
        : [...new Set(changes.inheritedFields ?? source.inheritedFields)],
    updatedAt: now
  }
}

export function updateProfileBehavior(
  source: ProfileDocument,
  resolvedBefore: BehaviorProfile,
  nextProfile: BehaviorProfile,
  now = new Date().toISOString()
): ProfileDocument {
  if (source.baseProfileId === null) {
    return updateProfileDocument(source, { profile: nextProfile }, now)
  }

  const changedFields = BEHAVIOR_FIELD_PATHS.filter(
    (path) => !Object.is(fieldValue(resolvedBefore, path), fieldValue(nextProfile, path))
  )
  const inheritedFields = source.inheritedFields.filter(
    (path) => !changedFields.includes(path)
  )

  return updateProfileDocument(
    source,
    {
      profile: nextProfile,
      inheritedFields
    },
    now
  )
}

export function resetProfileInheritance(
  source: ProfileDocument,
  documents: readonly ProfileDocument[],
  now = new Date().toISOString()
): ProfileDocument {
  if (source.baseProfileId === null) {
    return source
  }

  const base = documents.find((document) => document.id === source.baseProfileId)
  if (!base) {
    return detachProfileDocument(source, documents, now)
  }

  return updateProfileDocument(
    source,
    {
      profile: resolveProfileDocument(base, documents),
      inheritedFields: [...BEHAVIOR_FIELD_PATHS]
    },
    now
  )
}

export function detachProfileDocument(
  source: ProfileDocument,
  documents: readonly ProfileDocument[],
  now = new Date().toISOString()
): ProfileDocument {
  return {
    ...source,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    profile: resolveProfileDocument(source, documents),
    baseProfileId: null,
    inheritedFields: [],
    updatedAt: now
  }
}

export function resolveProfileDocument(
  source: ProfileDocument,
  documents: readonly ProfileDocument[],
  visited: ReadonlySet<string> = new Set()
): BehaviorProfile {
  if (source.baseProfileId === null) {
    return structuredClone(source.profile)
  }

  if (visited.has(source.id)) {
    throw new Error("Profile inheritance cycle detected at " + source.name + ".")
  }

  const base = documents.find((document) => document.id === source.baseProfileId)
  if (!base) {
    return structuredClone(source.profile)
  }

  const nextVisited = new Set(visited)
  nextVisited.add(source.id)

  const resolvedBase = resolveProfileDocument(base, documents, nextVisited)
  const resolved = structuredClone(source.profile)

  for (const path of source.inheritedFields) {
    inheritField(resolved, resolvedBase, path)
  }

  return resolved
}

export function materializeProfileDocument(
  source: ProfileDocument,
  documents: readonly ProfileDocument[],
  now = source.updatedAt
): ProfileDocument {
  return {
    ...source,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    profile: resolveProfileDocument(source, documents),
    baseProfileId: null,
    inheritedFields: [],
    updatedAt: now
  }
}

export function profileDependsOn(
  source: ProfileDocument,
  ancestorId: string,
  documents: readonly ProfileDocument[]
): boolean {
  const visited = new Set<string>()
  let current: ProfileDocument | undefined = source

  while (current?.baseProfileId) {
    if (visited.has(current.id)) return false
    visited.add(current.id)

    if (current.baseProfileId === ancestorId) return true
    current = documents.find((document) => document.id === current?.baseProfileId)
  }

  return false
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

  if (
    value.schemaVersion === PROFILE_SCHEMA_VERSION &&
    isBehaviorProfileV2(value.profile) &&
    (value.baseProfileId === null ||
      (typeof value.baseProfileId === "string" && value.baseProfileId !== value.id)) &&
    Array.isArray(value.inheritedFields) &&
    value.inheritedFields.every(isBehaviorFieldPath)
  ) {
    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id: value.id as string,
      name: value.name as string,
      description: value.description as string,
      profile: structuredClone(value.profile),
      baseProfileId: value.baseProfileId as string | null,
      inheritedFields: [...new Set(value.inheritedFields as BehaviorFieldPath[])],
      createdAt: value.createdAt as string,
      updatedAt: value.updatedAt as string
    }
  }

  if (value.schemaVersion === 2 && isBehaviorProfileV2(value.profile)) {
    return {
      ...createProfileDocument({
        id: value.id as string,
        name: value.name as string,
        description: value.description as string,
        profile: value.profile,
        now: value.createdAt as string
      }),
      updatedAt: value.updatedAt as string
    }
  }

  if (value.schemaVersion === 1 && isLegacyBehaviorProfileV1(value.profile)) {
    return {
      ...createProfileDocument({
        id: value.id as string,
        name: value.name as string,
        description: value.description as string,
        profile: migrateProfileV1(value.profile),
        now: value.createdAt as string
      }),
      updatedAt: value.updatedAt as string
    }
  }

  if (![1, 2, PROFILE_SCHEMA_VERSION].includes(Number(value.schemaVersion))) {
    throw new Error("Unsupported profile schema version.")
  }

  throw new Error("Profile file is invalid or incomplete.")
}
