import {
  parseProfileDocument,
  serializeProfileDocument,
  type ProfileDocument
} from "@humanizer/core"

const STORAGE_KEY = "humanizer.profiles.v1"
const ACTIVE_PROFILE_KEY = "humanizer.active-profile.v1"

export interface LoadedProfiles {
  profiles: ProfileDocument[]
  storageAvailable: boolean
}

export function loadProfiles(): LoadedProfiles {
  let serialized: string | null

  try {
    serialized = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return { profiles: [], storageAvailable: false }
  }

  if (!serialized) {
    return { profiles: [], storageAvailable: true }
  }

  try {
    const values: unknown = JSON.parse(serialized)

    if (!Array.isArray(values)) {
      return { profiles: [], storageAvailable: true }
    }

    return {
      profiles: values.flatMap((value) => {
        try {
          return [parseProfileDocument(JSON.stringify(value))]
        } catch {
          return []
        }
      }),
      storageAvailable: true
    }
  } catch {
    return { profiles: [], storageAvailable: true }
  }
}

export function saveProfiles(profiles: readonly ProfileDocument[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
    return true
  } catch {
    return false
  }
}

export function loadActiveProfileId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY)
  } catch {
    return null
  }
}

export function saveActiveProfileId(profileId: string | null): boolean {
  try {
    if (profileId === null) {
      window.localStorage.removeItem(ACTIVE_PROFILE_KEY)
    } else {
      window.localStorage.setItem(ACTIVE_PROFILE_KEY, profileId)
    }
    return true
  } catch {
    return false
  }
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
