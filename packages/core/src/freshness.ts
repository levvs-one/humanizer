import type { PromptSurface } from "./types"

export interface StaleTargetSource {
  targetId: string
  verifiedAt: string
  ageDays: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfUtcDay(value: string | Date): number {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("Reference date is invalid.")
    }

    return Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate()
    )
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new Error("Reference date must use YYYY-MM-DD.")
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Reference date is invalid.")
  }

  return timestamp
}

export function findStaleTargetSources(
  surfaces: readonly PromptSurface[],
  referenceDate: string | Date,
  maxAgeDays: number
): StaleTargetSource[] {
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) {
    throw new Error("Maximum source age must be a non-negative integer.")
  }

  const reference = startOfUtcDay(referenceDate)

  return surfaces.flatMap((surface) => {
    const verified = startOfUtcDay(surface.source.verifiedAt)
    const ageDays = Math.floor((reference - verified) / DAY_MS)

    if (ageDays <= maxAgeDays) {
      return []
    }

    return [{
      targetId: surface.id,
      verifiedAt: surface.source.verifiedAt,
      ageDays
    }]
  })
}
