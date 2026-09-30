import {
  isBehaviorOverrideSet,
  type BehaviorOverrideSet
} from "./overrides"

export const PROJECT_SCHEMA_VERSION = 2 as const

export type ModelBehaviorOverrideMap = Record<string, BehaviorOverrideSet>

export interface ProjectDocument {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  id: string
  name: string
  description: string
  behaviorOverrides: BehaviorOverrideSet
  modelOverrides: ModelBehaviorOverrideMap
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  id?: string
  name: string
  description?: string
  behaviorOverrides?: BehaviorOverrideSet
  modelOverrides?: ModelBehaviorOverrideMap
  now?: string
}

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  return "project-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isModelBehaviorOverrideMap(value: unknown): value is ModelBehaviorOverrideMap {
  if (!isRecord(value)) {
    return false
  }

  return Object.entries(value).every(
    ([modelId, overrides]) =>
      modelId.trim().length > 0 && isBehaviorOverrideSet(overrides)
  )
}

function cloneModelOverrides(
  value: ModelBehaviorOverrideMap
): ModelBehaviorOverrideMap {
  return Object.fromEntries(
    Object.entries(value).map(([modelId, overrides]) => [
      modelId,
      structuredClone(overrides)
    ])
  )
}

export function createProjectDocument(
  input: CreateProjectInput
): ProjectDocument {
  const now = input.now ?? new Date().toISOString()

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: input.id ?? createId(),
    name: input.name.trim() || "Untitled Project",
    description: input.description?.trim() ?? "",
    behaviorOverrides: structuredClone(input.behaviorOverrides ?? {}),
    modelOverrides: cloneModelOverrides(input.modelOverrides ?? {}),
    createdAt: now,
    updatedAt: now
  }
}

export function updateProjectDocument(
  source: ProjectDocument,
  changes: Partial<
    Pick<
      ProjectDocument,
      "name" | "description" | "behaviorOverrides" | "modelOverrides"
    >
  >,
  now = new Date().toISOString()
): ProjectDocument {
  return {
    ...source,
    name:
      changes.name === undefined
        ? source.name
        : changes.name.trim() || source.name,
    description:
      changes.description === undefined
        ? source.description
        : changes.description.trim(),
    behaviorOverrides:
      changes.behaviorOverrides === undefined
        ? source.behaviorOverrides
        : structuredClone(changes.behaviorOverrides),
    modelOverrides:
      changes.modelOverrides === undefined
        ? source.modelOverrides
        : cloneModelOverrides(changes.modelOverrides),
    updatedAt: now
  }
}

export function duplicateProjectDocument(
  source: ProjectDocument,
  options: { name?: string; now?: string } = {}
): ProjectDocument {
  return createProjectDocument({
    name: options.name?.trim() || source.name + " Copy",
    description: source.description,
    behaviorOverrides: source.behaviorOverrides,
    modelOverrides: source.modelOverrides,
    ...(options.now ? { now: options.now } : {})
  })
}

export function getProjectModelOverrides(
  project: ProjectDocument | null | undefined,
  modelId: string | null | undefined
): BehaviorOverrideSet {
  if (!project || !modelId) {
    return {}
  }

  return structuredClone(project.modelOverrides[modelId] ?? {})
}

export function serializeProjectDocument(document: ProjectDocument): string {
  return JSON.stringify(document, null, 2) + "\n"
}

export function parseProjectDocument(serialized: string): ProjectDocument {
  const value: unknown = JSON.parse(serialized)

  if (!isRecord(value)) {
    throw new Error("Project file must contain an object.")
  }

  const behaviorOverrides = value.behaviorOverrides

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isBehaviorOverrideSet(behaviorOverrides)
  ) {
    throw new Error("Project file is invalid or incomplete.")
  }

  if (
    value.schemaVersion === PROJECT_SCHEMA_VERSION &&
    isModelBehaviorOverrideMap(value.modelOverrides)
  ) {
    return {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: value.id as string,
      name: value.name as string,
      description: value.description as string,
      behaviorOverrides: structuredClone(behaviorOverrides),
      modelOverrides: cloneModelOverrides(value.modelOverrides),
      createdAt: value.createdAt as string,
      updatedAt: value.updatedAt as string
    }
  }

  if (value.schemaVersion === 1) {
    return {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: value.id as string,
      name: value.name as string,
      description: value.description as string,
      behaviorOverrides: structuredClone(behaviorOverrides),
      modelOverrides: {},
      createdAt: value.createdAt as string,
      updatedAt: value.updatedAt as string
    }
  }

  if (![1, PROJECT_SCHEMA_VERSION].includes(Number(value.schemaVersion))) {
    throw new Error("Unsupported project schema version.")
  }

  throw new Error("Project file is invalid or incomplete.")
}
