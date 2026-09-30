import { useRef, useState } from "react"
import {
  parseProjectDocument,
  updateProjectDocument,
  type BehaviorFieldPath,
  type BehaviorOverrideValue,
  type BehaviorProfile,
  type ProjectDocument
} from "@humanizer/core"
import { downloadProject } from "./project-storage"

interface ProjectScopePanelProps {
  projects: ProjectDocument[]
  activeProject: ProjectDocument | null
  baseProfile: BehaviorProfile
  onSelect: (projectId: string | null) => void
  onCreate: () => void
  onImport: (project: ProjectDocument) => void
  onUpdate: (project: ProjectDocument) => void
  onDelete: (projectId: string) => void
}

export default function ProjectScopePanel({
  projects,
  activeProject,
  baseProfile,
  onSelect,
  onCreate,
  onImport,
  onUpdate,
  onDelete
}: ProjectScopePanelProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const overrides = activeProject?.behaviorOverrides ?? {}
  const overrideCount = Object.keys(overrides).length

  async function importProject(file: File | undefined) {
    if (!file) return

    try {
      onImport(parseProjectDocument(await file.text()))
      setImportError(null)
    } catch (reason) {
      setImportError(
        reason instanceof Error ? reason.message : "Could not import this project."
      )
    } finally {
      if (fileInput.current) {
        fileInput.current.value = ""
      }
    }
  }

  function setOverride(
    path: BehaviorFieldPath,
    value: BehaviorOverrideValue | undefined
  ) {
    if (!activeProject) {
      return
    }

    const next = { ...activeProject.behaviorOverrides }

    if (value === undefined) {
      delete next[path]
    } else {
      next[path] = value
    }

    onUpdate(
      updateProjectDocument(activeProject, {
        behaviorOverrides: next
      })
    )
  }

  function numericOverride(path: BehaviorFieldPath): string {
    const value = overrides[path]
    return typeof value === "number" ? String(value) : ""
  }

  function scoreOverride(value: string): number | undefined {
    if (value === "") {
      return undefined
    }

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      return undefined
    }

    return Math.max(0, Math.min(100, parsed))
  }

  return (
    <section className="panel compact-summary-panel">
      <div className="panel-heading">
        <h2>Project scope</h2>
        <p>Share behavior overrides across multiple prompt drafts.</p>
      </div>

      <div className="two-column-fields">
        <div className="field">
          <div className="field-heading">
            <label>Project</label>
            <span>Optional</span>
          </div>
          <select
            value={activeProject?.id ?? ""}
            onChange={(event) =>
              onSelect(event.target.value === "" ? null : event.target.value)
            }
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field project-create-field">
          <div className="field-heading">
            <label>Scope</label>
            <span>{overrideCount} overrides</span>
          </div>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept=".json,.humanizer-project.json,application/json"
            onChange={(event) => void importProject(event.target.files?.[0])}
          />
          <div className="draft-actions">
            <button className="secondary-button" type="button" onClick={onCreate}>
              New project
            </button>
            <button
              className="plain-button"
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              Import
            </button>
            {activeProject ? (
              <button
                className="plain-button"
                type="button"
                onClick={() => downloadProject(activeProject)}
              >
                Export
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {importError ? <div className="inline-error">{importError}</div> : null}

      {activeProject ? (
        <>
          <div className="field">
            <div className="field-heading"><label>Project name</label></div>
            <input
              value={activeProject.name}
              onChange={(event) =>
                onUpdate(
                  updateProjectDocument(activeProject, {
                    name: event.target.value
                  })
                )
              }
            />
          </div>

          <div className="field">
            <div className="field-heading">
              <label>Description</label>
              <span>Optional</span>
            </div>
            <input
              value={activeProject.description}
              placeholder="What this project scope is for"
              onChange={(event) =>
                onUpdate(
                  updateProjectDocument(activeProject, {
                    description: event.target.value
                  })
                )
              }
            />
          </div>

          <details className="advanced-behavior">
            <summary>
              Project behavior overrides
              {overrideCount > 0 ? " (" + overrideCount + ")" : ""}
            </summary>

            <div className="advanced-behavior-content">
              <div className="field">
                <div className="field-heading">
                  <label>Role</label>
                  <span>Blank inherits the profile</span>
                </div>
                <input
                  value={
                    typeof overrides.role === "string"
                      ? overrides.role
                      : ""
                  }
                  placeholder={baseProfile.role}
                  onChange={(event) =>
                    setOverride(
                      "role",
                      event.target.value === "" ? undefined : event.target.value
                    )
                  }
                />
              </div>

              <div className="field">
                <div className="field-heading">
                  <label>Objective</label>
                  <span>Blank inherits the profile</span>
                </div>
                <textarea
                  rows={3}
                  value={
                    typeof overrides.objective === "string"
                      ? overrides.objective
                      : ""
                  }
                  placeholder={baseProfile.objective}
                  onChange={(event) =>
                    setOverride(
                      "objective",
                      event.target.value === "" ? undefined : event.target.value
                    )
                  }
                />
              </div>

              <div className="two-column-fields">
                <div className="field">
                  <div className="field-heading"><label>Verbosity</label></div>
                  <select
                    value={
                      typeof overrides["communication.verbosity"] === "string"
                        ? String(overrides["communication.verbosity"])
                        : ""
                    }
                    onChange={(event) =>
                      setOverride(
                        "communication.verbosity",
                        event.target.value === "" ? undefined : event.target.value
                      )
                    }
                  >
                    <option value="">
                      Profile default ({baseProfile.communication.verbosity})
                    </option>
                    <option value="low">Compact</option>
                    <option value="medium">Balanced</option>
                    <option value="high">Detailed</option>
                  </select>
                </div>

                <div className="field">
                  <div className="field-heading">
                    <label>Directness</label>
                    <span>0–100</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={numericOverride("communication.directness")}
                    placeholder={String(baseProfile.communication.directness)}
                    onChange={(event) =>
                      setOverride(
                        "communication.directness",
                        scoreOverride(event.target.value)
                      )
                    }
                  />
                </div>
              </div>

              <div className="two-column-fields">
                <div className="field">
                  <div className="field-heading"><label>Tool use</label></div>
                  <select
                    value={
                      typeof overrides["tools.usage"] === "string"
                        ? String(overrides["tools.usage"])
                        : ""
                    }
                    onChange={(event) =>
                      setOverride(
                        "tools.usage",
                        event.target.value === "" ? undefined : event.target.value
                      )
                    }
                  >
                    <option value="">
                      Profile default ({baseProfile.tools.usage})
                    </option>
                    <option value="off">Off</option>
                    <option value="when-useful">When useful</option>
                    <option value="proactive">Proactive</option>
                  </select>
                </div>

                <div className="field">
                  <div className="field-heading"><label>External actions</label></div>
                  <select
                    value={
                      typeof overrides["tools.confirmExternalActions"] === "boolean"
                        ? String(overrides["tools.confirmExternalActions"])
                        : ""
                    }
                    onChange={(event) =>
                      setOverride(
                        "tools.confirmExternalActions",
                        event.target.value === ""
                          ? undefined
                          : event.target.value === "true"
                      )
                    }
                  >
                    <option value="">
                      Profile default ({baseProfile.tools.confirmExternalActions ? "confirm" : "allowed"})
                    </option>
                    <option value="true">Confirm consequential actions</option>
                    <option value="false">No extra confirmation rule</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <div className="field-heading"><label>Read-only first</label></div>
                <select
                  value={
                    typeof overrides["tools.preferReadOnly"] === "boolean"
                      ? String(overrides["tools.preferReadOnly"])
                      : ""
                  }
                  onChange={(event) =>
                    setOverride(
                      "tools.preferReadOnly",
                      event.target.value === ""
                        ? undefined
                        : event.target.value === "true"
                    )
                  }
                >
                  <option value="">
                    Profile default ({baseProfile.tools.preferReadOnly ? "yes" : "no"})
                  </option>
                  <option value="true">Prefer read-only inspection</option>
                  <option value="false">No read-only preference</option>
                </select>
              </div>

              <div className="two-column-fields">
                <div className="field">
                  <div className="field-heading">
                    <label>Verification</label>
                    <span>0–100</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={numericOverride("reasoning.verification")}
                    placeholder={String(baseProfile.reasoning.verification)}
                    onChange={(event) =>
                      setOverride(
                        "reasoning.verification",
                        scoreOverride(event.target.value)
                      )
                    }
                  />
                </div>

                <div className="field">
                  <div className="field-heading">
                    <label>Research rigor</label>
                    <span>0–100</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={numericOverride("research.rigor")}
                    placeholder={String(baseProfile.research.rigor)}
                    onChange={(event) =>
                      setOverride(
                        "research.rigor",
                        scoreOverride(event.target.value)
                      )
                    }
                  />
                </div>
              </div>

              <div className="draft-actions">
                {overrideCount > 0 ? (
                  <button
                    className="plain-button"
                    type="button"
                    onClick={() =>
                      onUpdate(
                        updateProjectDocument(activeProject, {
                          behaviorOverrides: {}
                        })
                      )
                    }
                  >
                    Reset project overrides
                  </button>
                ) : null}

                <button
                  className="plain-button danger"
                  type="button"
                  onClick={() => onDelete(activeProject.id)}
                >
                  Delete project
                </button>
              </div>
            </div>
          </details>
        </>
      ) : null}
    </section>
  )
}
