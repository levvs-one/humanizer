import type { RuntimeMessage } from "./runtime"

const STORAGE_KEY = "humanizer.conversations.v1"
const SCHEMA_VERSION = 2 as const
const MAX_SESSIONS = 30
const MAX_MESSAGES_PER_SESSION = 100

export interface ConversationSession {
  key: string
  draftId: string | null
  messages: RuntimeMessage[]
  updatedAt: string
}

export interface LoadedConversationSessions {
  sessions: ConversationSession[]
  storageAvailable: boolean
}

interface ConversationStore {
  schemaVersion: typeof SCHEMA_VERSION
  sessions: ConversationSession[]
}

interface LegacyConversationSession {
  key: string
  messages: RuntimeMessage[]
  updatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!isRecord(value)) {
    return false
  }

  return (
    (value.role === "user" || value.role === "assistant") &&
    typeof value.text === "string" &&
    value.text.trim().length > 0
  )
}

function hasConversationFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.key === "string" &&
    value.key.length > 0 &&
    typeof value.updatedAt === "string" &&
    !Number.isNaN(Date.parse(value.updatedAt)) &&
    Array.isArray(value.messages) &&
    value.messages.every(isRuntimeMessage)
  )
}

function isConversationSession(value: unknown): value is ConversationSession {
  return (
    isRecord(value) &&
    hasConversationFields(value) &&
    (value.draftId === null || typeof value.draftId === "string")
  )
}

function isLegacyConversationSession(
  value: unknown
): value is LegacyConversationSession {
  return isRecord(value) && hasConversationFields(value)
}

function parseConversationStore(value: unknown): ConversationSession[] | null {
  if (!isRecord(value) || !Array.isArray(value.sessions)) {
    return null
  }

  if (value.schemaVersion === SCHEMA_VERSION) {
    return value.sessions.filter(isConversationSession)
  }

  if (value.schemaVersion === 1) {
    return value.sessions
      .filter(isLegacyConversationSession)
      .map((session) => ({
        key: session.key,
        draftId: null,
        messages: session.messages.map((message) => ({ ...message })),
        updatedAt: session.updatedAt
      }))
  }

  return null
}

function textFingerprint(value: string): string {
  let left = 0x811c9dc5
  let right = 0x9e3779b9

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    left = Math.imul(left ^ code, 0x01000193)
    right = Math.imul(right ^ code, 0x85ebca6b)
  }

  return (
    (left >>> 0).toString(36) +
    "-" +
    (right >>> 0).toString(36) +
    "-" +
    value.length.toString(36)
  )
}

export function createConversationSessionKey(
  draftId: string,
  modelId: string,
  surfaceId: string,
  compiledPrompt: string
): string {
  return [
    draftId,
    modelId,
    surfaceId,
    textFingerprint(compiledPrompt)
  ].join(":")
}

function normalizeSessions(
  sessions: readonly ConversationSession[]
): ConversationSession[] {
  return [...sessions]
    .filter((session) => session.messages.length > 0)
    .map((session) => ({
      key: session.key,
      draftId: session.draftId,
      messages: session.messages
        .slice(-MAX_MESSAGES_PER_SESSION)
        .map((message) => ({ ...message })),
      updatedAt: session.updatedAt
    }))
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    )
    .slice(0, MAX_SESSIONS)
}

export function loadConversationSessions(): LoadedConversationSessions {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY)
    if (!serialized) {
      return { sessions: [], storageAvailable: true }
    }

    const sessions = parseConversationStore(JSON.parse(serialized))
    return {
      sessions: sessions === null ? [] : normalizeSessions(sessions),
      storageAvailable: true
    }
  } catch {
    return { sessions: [], storageAvailable: false }
  }
}

export function saveConversationSessions(
  sessions: readonly ConversationSession[]
): boolean {
  try {
    const store: ConversationStore = {
      schemaVersion: SCHEMA_VERSION,
      sessions: normalizeSessions(sessions)
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

export function clearStoredConversationSession(key: string): boolean {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY)
    if (!serialized) {
      return true
    }

    const sessions = parseConversationStore(JSON.parse(serialized))
    if (sessions === null) {
      return true
    }

    const store: ConversationStore = {
      schemaVersion: SCHEMA_VERSION,
      sessions: normalizeSessions(
        sessions.filter((session) => session.key !== key)
      )
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

export function upsertConversationSession(
  sessions: readonly ConversationSession[],
  key: string,
  draftId: string,
  messages: readonly RuntimeMessage[],
  now = new Date().toISOString()
): ConversationSession[] {
  const next = sessions.filter((session) => session.key !== key)

  if (messages.length > 0) {
    next.push({
      key,
      draftId,
      messages: messages.map((message) => ({ ...message })),
      updatedAt: now
    })
  }

  return normalizeSessions(next)
}

export function removeConversationSession(
  sessions: readonly ConversationSession[],
  key: string
): ConversationSession[] {
  return sessions.filter((session) => session.key !== key)
}

export function removeConversationSessionsForDraft(
  sessions: readonly ConversationSession[],
  draftId: string
): ConversationSession[] {
  return sessions.filter((session) => session.draftId !== draftId)
}

export function conversationSessionMap(
  sessions: readonly ConversationSession[]
): Record<string, RuntimeMessage[]> {
  return Object.fromEntries(
    sessions.map((session) => [
      session.key,
      session.messages.map((message) => ({ ...message }))
    ])
  )
}
