import { describe, expect, it } from "vitest"
import { findStaleModelSources, findStaleTargetSources } from "./freshness"
import type { ModelDefinition, PromptSurface } from "./types"

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

function model(id: string, verifiedAt: string): ModelDefinition {
  return {
    id,
    provider: "openai",
    label: "Test model",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 100_000,
    source: {
      label: "Test model source",
      url: "https://example.com/model",
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

  it("reports stale model metadata independently from target surfaces", () => {
    expect(
      findStaleModelSources(
        [
          model("fresh-model", "2026-09-20"),
          model("stale-model", "2026-05-01")
        ],
        "2026-09-30",
        90
      )
    ).toEqual([
      {
        modelId: "stale-model",
        verifiedAt: "2026-05-01",
        ageDays: 152
      }
    ])
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
