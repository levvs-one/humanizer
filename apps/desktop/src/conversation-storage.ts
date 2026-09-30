import type { RuntimeMessage } from "./runtime"

const STORAGE_KEY = "humanizer.conversations.v1"
const SCHEMA_VERSION = 1 as const
const MAX_SESSIONS = 30
const MAX_MESSAGES_PER_SESSION = 100

export interface ConversationSession {
  key: string
  messages: RuntimeMessage[]
  updatedAt: string
}

interface ConversationStore {
  schemaVersion: typeof SCHEMA_VERSION
  sessions: ConversationSession[]
}

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    (record.role === "user" || record.role === "assistant") &&
    typeof record.text === "string" &&
    record.text.trim().length > 0
  )
}

function isConversationSession(value: unknown): value is ConversationSession {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.key === "string" &&
    record.key.length > 0 &&
    typeof record.updatedAt === "string" &&
    !Number.isNaN(Date.parse(record.updatedAt)) &&
    Array.isArray(record.messages) &&
    record.messages.every(isRuntimeMessage)
  )
}

function normalizeSessions(
  sessions: readonly ConversationSession[]
): ConversationSession[] {
  return [...sessions]
    .filter((session) => session.messages.length > 0)
    .map((session) => ({
      key: session.key,
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

export function loadConversationSessions(): ConversationSession[] {
  const serialized = window.localStorage.getItem(STORAGE_KEY)
  if (!serialized) {
    return []
  }

  try {
    const value: unknown = JSON.parse(serialized)
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value)
    ) {
      return []
    }

    const record = value as Record<string, unknown>
    if (
      record.schemaVersion !== SCHEMA_VERSION ||
      !Array.isArray(record.sessions)
    ) {
      return []
    }

    return normalizeSessions(
      record.sessions.filter(isConversationSession)
    )
  } catch {
    return []
  }
}

export function saveConversationSessions(
  sessions: readonly ConversationSession[]
): void {
  const store: ConversationStore = {
    schemaVersion: SCHEMA_VERSION,
    sessions: normalizeSessions(sessions)
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function upsertConversationSession(
  sessions: readonly ConversationSession[],
  key: string,
  messages: readonly RuntimeMessage[],
  now = new Date().toISOString()
): ConversationSession[] {
  const next = sessions.filter((session) => session.key !== key)

  if (messages.length > 0) {
    next.push({
      key,
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
