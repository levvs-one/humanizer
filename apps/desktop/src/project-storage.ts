import {
  parseProjectDocument,
  serializeProjectDocument,
  type ProjectDocument
} from "@humanizer/core"

const STORAGE_KEY = "humanizer.projects.v1"

export interface LoadedProjects {
  projects: ProjectDocument[]
  storageAvailable: boolean
}

export function loadProjects(): LoadedProjects {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY)
    if (!serialized) {
      return { projects: [], storageAvailable: true }
    }

    const values: unknown = JSON.parse(serialized)
    if (!Array.isArray(values)) {
      return { projects: [], storageAvailable: true }
    }

    const projects = values.flatMap((value) => {
      try {
        return [parseProjectDocument(JSON.stringify(value))]
      } catch {
        return []
      }
    })

    return { projects, storageAvailable: true }
  } catch {
    return { projects: [], storageAvailable: false }
  }
}

export function saveProjects(projects: readonly ProjectDocument[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    return true
  } catch {
    return false
  }
}

export function downloadProject(project: ProjectDocument): void {
  const blob = new Blob([serializeProjectDocument(project)], {
    type: "application/json;charset=utf-8"
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download =
    project.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + ".humanizer-project.json"
  anchor.click()
  URL.revokeObjectURL(url)
}
