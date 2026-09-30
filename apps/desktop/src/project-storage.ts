import {
  parseProjectDocument,
  serializeProjectDocument,
  type ProjectDocument
} from "@humanizer/core"

const STORAGE_KEY = "humanizer.projects.v1"

export function loadProjects(): ProjectDocument[] {
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
        return [parseProjectDocument(JSON.stringify(value))]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

export function saveProjects(projects: readonly ProjectDocument[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
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
