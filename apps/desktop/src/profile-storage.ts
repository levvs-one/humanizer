import {
  parseProfileDocument,
  serializeProfileDocument,
  type ProfileDocument
} from "@humanizer/core"

const STORAGE_KEY = "humanizer.profiles.v1"
const ACTIVE_PROFILE_KEY = "humanizer.active-profile.v1"

export function loadProfiles(): ProfileDocument[] {
  const serialized = window.localStorage.getItem(STORAGE_KEY)

  if (!serialized) {
    return []
  }

  try {
    const values: unknown = JSON.parse(serialized)

    if (!Array.isArray(values)) {
      return []
    }

    return values.flatMap((value) => {
      try {
        return [parseProfileDocument(JSON.stringify(value))]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

export function saveProfiles(profiles: readonly ProfileDocument[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
}

export function loadActiveProfileId(): string | null {
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY)
}

export function saveActiveProfileId(profileId: string): void {
  window.localStorage.setItem(ACTIVE_PROFILE_KEY, profileId)
}

export function downloadProfile(profile: ProfileDocument): void {
  const blob = new Blob([serializeProfileDocument(profile)], {
    type: "application/json;charset=utf-8"
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = profile.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + ".humanizer.json"
  anchor.click()
  URL.revokeObjectURL(url)
}
