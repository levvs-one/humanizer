import { describe, expect, it } from "vitest"
import { findStaleTargetSources } from "./freshness"
import type { PromptSurface } from "./types"

function surface(id: string, verifiedAt: string): PromptSurface {
  return {
    id,
    provider: "openai",
    product: "Test",
    label: "Test",
    instructionRole: "persistent",
    characterLimit: { kind: "unknown" },
    source: {
      label: "Test source",
      url: "https://example.com",
      verifiedAt
    }
  }
}

describe("registry freshness", () => {
  it("reports only sources older than the configured age", () => {
    const result = findStaleTargetSources(
      [
        surface("fresh", "2026-09-20"),
        surface("stale", "2026-08-01")
      ],
      "2026-09-30",
      30
    )

    expect(result).toEqual([
      {
        targetId: "stale",
        verifiedAt: "2026-08-01",
        ageDays: 60
      }
    ])
  })

  it("treats the exact threshold as fresh", () => {
    expect(
      findStaleTargetSources(
        [surface("boundary", "2026-08-31")],
        "2026-09-30",
        30
      )
    ).toEqual([])
  })

  it("handles month and year boundaries in UTC days", () => {
    const month = findStaleTargetSources(
      [surface("month", "2026-01-31")],
      "2026-03-01",
      28
    )
    const year = findStaleTargetSources(
      [surface("year", "2025-12-31")],
      "2026-01-02",
      1
    )

    expect(month[0]?.ageDays).toBe(29)
    expect(year[0]?.ageDays).toBe(2)
  })

  it("rejects invalid reference dates and thresholds", () => {
    expect(() =>
      findStaleTargetSources([], "2026-02-30", 30)
    ).toThrow("Reference date is invalid")

    expect(() =>
      findStaleTargetSources([], "2026-09-30", -1)
    ).toThrow("non-negative integer")
  })
})
