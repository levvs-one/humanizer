import {
  updateProjectDocument,
  type BehaviorFieldPath,
  type BehaviorOverrideValue,
  type BehaviorProfile,
  type ProjectDocument
} from "@humanizer/core"

interface ProjectScopePanelProps {
  projects: ProjectDocument[]
  activeProject: ProjectDocument | null
  baseProfile: BehaviorProfile
  onSelect: (projectId: string | null) => void
  onCreate: () => void
  onUpdate: (project: ProjectDocument) => void
  onDelete: (projectId: string) => void
}

export default function ProjectScopePanel({
  projects,
  activeProject,
  baseProfile,
  onSelect,
  onCreate,
  onUpdate,
  onDelete
}: ProjectScopePanelProps) {
  const overrides = activeProject?.behaviorOverrides ?? {}
  const overrideCount = Object.keys(overrides).length

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
          <button className="secondary-button" type="button" onClick={onCreate}>
            New project
          </button>
        </div>
      </div>

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
