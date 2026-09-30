import {
  isBehaviorOverrideSet,
  type BehaviorOverrideSet
} from "./overrides"

export const PROJECT_SCHEMA_VERSION = 1 as const

export interface ProjectDocument {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  id: string
  name: string
  description: string
  behaviorOverrides: BehaviorOverrideSet
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  id?: string
  name: string
  description?: string
  behaviorOverrides?: BehaviorOverrideSet
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
    createdAt: now,
    updatedAt: now
  }
}

export function updateProjectDocument(
  source: ProjectDocument,
  changes: Partial<
    Pick<ProjectDocument, "name" | "description" | "behaviorOverrides">
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
    ...(options.now ? { now: options.now } : {})
  })
}

export function serializeProjectDocument(document: ProjectDocument): string {
  return JSON.stringify(document, null, 2) + "\n"
}

export function parseProjectDocument(serialized: string): ProjectDocument {
  const value: unknown = JSON.parse(serialized)

  if (!isRecord(value)) {
    throw new Error("Project file must contain an object.")
  }

  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error("Unsupported project schema version.")
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isBehaviorOverrideSet(value.behaviorOverrides)
  ) {
    throw new Error("Project file is invalid or incomplete.")
  }

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: value.id,
    name: value.name,
    description: value.description,
    behaviorOverrides: structuredClone(value.behaviorOverrides),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
}
