import { afterEach, describe, expect, it, vi } from "vitest"
import {
  loadConversationSessions,
  removeConversationSessionsForDraft,
  saveConversationSessions,
  upsertConversationSession,
  type ConversationSession
} from "./conversation-storage"

function stubStorage(serialized: string | null) {
  const getItem = vi.fn(() => serialized)
  const setItem = vi.fn()

  vi.stubGlobal("window", {
    localStorage: {
      getItem,
      setItem
    }
  })

  return { getItem, setItem }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("conversation storage", () => {
  it("migrates v1 sessions without dropping messages", () => {
    stubStorage(
      JSON.stringify({
        schemaVersion: 1,
        sessions: [
          {
            key: "legacy-key",
            messages: [
              { role: "user", text: "Question" },
              { role: "assistant", text: "Answer" }
            ],
            updatedAt: "2026-09-30T12:00:00.000Z"
          }
        ]
      })
    )

    const loaded = loadConversationSessions()

    expect(loaded.storageAvailable).toBe(true)
    expect(loaded.sessions).toEqual([
      {
        key: "legacy-key",
        draftId: null,
        messages: [
          { role: "user", text: "Question" },
          { role: "assistant", text: "Answer" }
        ],
        updatedAt: "2026-09-30T12:00:00.000Z"
      }
    ])
  })

  it("writes schema v2 with explicit draft ownership", () => {
    const { setItem } = stubStorage(null)

    const sessions = upsertConversationSession(
      [],
      "key",
      "draft-a",
      [
        { role: "user", text: "Question" },
        { role: "assistant", text: "Answer" }
      ],
      "2026-09-30T12:00:00.000Z"
    )

    expect(saveConversationSessions(sessions)).toBe(true)

    const serialized = setItem.mock.calls[0]?.[1]
    const stored = JSON.parse(String(serialized))

    expect(stored.schemaVersion).toBe(2)
    expect(stored.sessions[0].draftId).toBe("draft-a")
  })

  it("removes only sessions owned by the exact draft id", () => {
    const sessions: ConversationSession[] = [
      {
        key: "first",
        draftId: "a",
        messages: [{ role: "user", text: "One" }],
        updatedAt: "2026-09-30T12:00:00.000Z"
      },
      {
        key: "second",
        draftId: "a:b",
        messages: [{ role: "user", text: "Two" }],
        updatedAt: "2026-09-30T12:00:00.000Z"
      },
      {
        key: "legacy",
        draftId: null,
        messages: [{ role: "user", text: "Legacy" }],
        updatedAt: "2026-09-30T12:00:00.000Z"
      }
    ]

    expect(
      removeConversationSessionsForDraft(sessions, "a").map(
        (session) => session.draftId
      )
    ).toEqual(["a:b", null])
  })

  it("falls back cleanly when local storage is unavailable", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => {
          throw new Error("SecurityError")
        }),
        setItem: vi.fn(() => {
          throw new Error("QuotaExceededError")
        })
      }
    })

    expect(loadConversationSessions()).toEqual({
      sessions: [],
      storageAvailable: false
    })
    expect(saveConversationSessions([])).toBe(false)
  })
})
