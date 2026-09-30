import { useEffect, useRef, useState } from "react"
import {
  compilePrompt,
  createPromptDraftDocument,
  duplicatePromptDraftDocument,
  MODELS,
  parsePromptDraftDocument,
  SURFACES,
  updatePromptDraftDocument,
  type PlanId,
  type ProfileDocument,
  type PromptBrief,
  type PromptDraftDocument,
  type PromptOptimization,
  type ProviderId
} from "@humanizer/core"
import {
  downloadCompiledPrompt,
  downloadPromptDraft,
  loadActivePromptDraftId,
  loadPromptDrafts,
  saveActivePromptDraftId,
  savePromptDrafts
} from "./prompt-draft-storage"

const plans: Array<{ value: PlanId; label: string }> = [
  { value: "free", label: "Free" },
  { value: "go", label: "Go" },
  { value: "plus", label: "Plus" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
  { value: "enterprise", label: "Enterprise" },
  { value: "education", label: "Education" }
]

const providerLabels: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google"
}

function formatTokens(value: number | null): string {
  if (value === null) return "Not verified"
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(value % 1_000_000 ? 2 : 0) + "M tokens"
  }
  if (value >= 1_000) return Math.round(value / 1_000) + "K tokens"
  return value.toLocaleString() + " tokens"
}

function createDefaultDraft(profileId: string): PromptDraftDocument {
  const model = MODELS[0]
  const surface = SURFACES[0]

  if (!model || !surface) {
    throw new Error("Prompt Studio registry is empty.")
  }

  return createPromptDraftDocument({
    profileId,
    target: {
      modelId: model.id,
      surfaceId: surface.id,
      ...(surface.characterLimit.kind === "by-plan" ? { plan: "plus" as PlanId } : {}),
      optimization: "balanced"
    }
  })
}

export default function PromptStudioView({
  profiles,
  defaultProfileId
}: {
  profiles: ProfileDocument[]
  defaultProfileId: string
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [drafts, setDrafts] = useState<PromptDraftDocument[]>(() => {
    const stored = loadPromptDrafts()
    return stored.length > 0 ? stored : [createDefaultDraft(defaultProfileId)]
  })
  const [activeDraftId, setActiveDraftId] = useState(() => {
    const stored = loadActivePromptDraftId()
    return stored ?? drafts[0]?.id ?? ""
  })
  const [copied, setCopied] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const draft = drafts.find((entry) => entry.id === activeDraftId) ?? drafts[0]

  useEffect(() => {
    savePromptDrafts(drafts)
  }, [drafts])

  useEffect(() => {
    if (draft?.id) {
      saveActivePromptDraftId(draft.id)
    }
  }, [draft?.id])

  if (!draft) {
    return null
  }

  const activeDraft = draft
  const firstModel = MODELS[0]
  const model = MODELS.find((entry) => entry.id === activeDraft.target.modelId) ?? firstModel

  if (!model) {
    throw new Error("Model registry is empty.")
  }

  const activeModel = model
  const surfaces = SURFACES.filter((entry) => entry.provider === activeModel.provider)
  const surface =
    surfaces.find((entry) => entry.id === activeDraft.target.surfaceId) ?? surfaces[0]

  if (!surface) {
    throw new Error("No prompt surface for selected model.")
  }

  const profile =
    profiles.find((entry) => entry.id === activeDraft.profileId) ??
    profiles.find((entry) => entry.id === defaultProfileId) ??
    profiles[0]

  if (!profile) {
    throw new Error("At least one behavior profile is required.")
  }

  const activeProfile = profile
  const activeSurface = surface
  const needsPlan = activeSurface.characterLimit.kind === "by-plan"
  const plan = activeDraft.target.plan ?? "plus"
  const optimization = activeDraft.target.optimization ?? "balanced"

  const result = compilePrompt({
    profile: activeProfile.profile,
    brief: activeDraft.brief,
    target: {
      surfaceId: activeSurface.id,
      modelId: activeModel.id,
      ...(needsPlan ? { plan } : {}),
      optimization
    }
  })

  function replaceDraft(next: PromptDraftDocument) {
    setDrafts((current) =>
      current.map((entry) => (entry.id === next.id ? next : entry))
    )
    setCopied(false)
  }

  function patchDraft(
    changes: Partial<
      Pick<PromptDraftDocument, "name" | "profileId" | "target" | "brief">
    >
  ) {
    replaceDraft(updatePromptDraftDocument(activeDraft, changes))
  }

  function chooseModel(nextId: string) {
    const nextModel = MODELS.find((entry) => entry.id === nextId)
    if (!nextModel) return

    const nextSurface = SURFACES.find(
      (entry) => entry.provider === nextModel.provider
    )

    if (!nextSurface) return

    patchDraft({
      target: {
        modelId: nextModel.id,
        surfaceId: nextSurface.id,
        ...(nextSurface.characterLimit.kind === "by-plan"
          ? { plan: activeDraft.target.plan ?? "plus" }
          : {}),
        optimization: activeDraft.target.optimization ?? "balanced"
      }
    })
  }

  function chooseSurface(nextSurfaceId: string) {
    const nextSurface = SURFACES.find((entry) => entry.id === nextSurfaceId)
    if (!nextSurface) return

    patchDraft({
      target: {
        modelId: activeModel.id,
        surfaceId: nextSurface.id,
        ...(nextSurface.characterLimit.kind === "by-plan"
          ? { plan: activeDraft.target.plan ?? "plus" }
          : {}),
        optimization: activeDraft.target.optimization ?? "balanced"
      }
    })
  }

  function updateBrief(field: keyof PromptBrief, value: string) {
    patchDraft({
      brief: {
        ...activeDraft.brief,
        [field]: value
      }
    })
  }

  function newDraft() {
    const next = createDefaultDraft(activeProfile.id)
    setDrafts((current) => [...current, next])
    setActiveDraftId(next.id)
    setImportError(null)
  }

  function duplicateDraft() {
    const next = duplicatePromptDraftDocument(activeDraft)
    setDrafts((current) => [...current, next])
    setActiveDraftId(next.id)
    setImportError(null)
  }

  function deleteDraft() {
    if (drafts.length <= 1) return

    const next = drafts.filter((entry) => entry.id !== activeDraft.id)
    setDrafts(next)
    setActiveDraftId(next[0]?.id ?? "")
    setImportError(null)
  }

  async function importDraft(file: File | undefined) {
    if (!file) return

    try {
      const imported = parsePromptDraftDocument(await file.text())
      const profileId = profiles.some((entry) => entry.id === imported.profileId)
        ? imported.profileId
        : defaultProfileId
      const collision = drafts.some((entry) => entry.id === imported.id)
      const next = collision
        ? createPromptDraftDocument({
            name: imported.name,
            profileId,
            target: imported.target,
            brief: imported.brief
          })
        : updatePromptDraftDocument(imported, { profileId })

      setDrafts((current) => [...current, next])
      setActiveDraftId(next.id)
      setImportError(null)
    } catch (reason) {
      setImportError(
        reason instanceof Error ? reason.message : "Could not import this prompt draft."
      )
    } finally {
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(result.text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const status =
    result.status === "fits"
      ? "Fits target"
      : result.status === "overflow"
        ? "Does not fit target"
        : "No verified hard character limit"

  return (
    <main className="page">
      <header className="page-header studio-page-header">
        <div>
          <h1>Prompt Studio</h1>
          <p>
            Choose a model and prompt type, describe the job, and compile it with a behavior profile.
          </p>
        </div>
        <span className="local-save-note">Saved locally</span>
      </header>

      <section className="draft-toolbar" aria-label="Prompt drafts">
        <div className="draft-picker">
          <label htmlFor="prompt-draft">Draft</label>
          <select
            id="prompt-draft"
            value={activeDraft.id}
            onChange={(event) => setActiveDraftId(event.target.value)}
          >
            {drafts.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name || "Untitled Prompt"}
              </option>
            ))}
          </select>
        </div>

        <input
          className="draft-name-input"
          aria-label="Draft name"
          value={activeDraft.name}
          onChange={(event) => patchDraft({ name: event.target.value })}
        />

        <div className="draft-actions">
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept=".json,.humanizer-prompt.json,application/json"
            onChange={(event) => void importDraft(event.target.files?.[0])}
          />
          <button className="plain-button" type="button" onClick={newDraft}>New</button>
          <button className="plain-button" type="button" onClick={duplicateDraft}>Duplicate</button>
          <button className="plain-button" type="button" onClick={() => fileInput.current?.click()}>Import</button>
          <button className="plain-button" type="button" onClick={() => downloadPromptDraft(activeDraft)}>Export</button>
          <button
            className="plain-button danger"
            type="button"
            disabled={drafts.length <= 1}
            onClick={deleteDraft}
          >
            Delete
          </button>
        </div>
      </section>

      {importError ? <div className="inline-error draft-error">{importError}</div> : null}

      <div className="studio-layout">
        <div className="studio-controls">
          <section className="panel">
            <div className="panel-heading">
              <h2>Target</h2>
              <p>The model and the place where the prompt is used are separate constraints.</p>
            </div>

            <div className="two-column-fields">
              <div className="field">
                <div className="field-heading"><label>Model</label></div>
                <select value={activeModel.id} onChange={(event) => chooseModel(event.target.value)}>
                  {(Object.keys(providerLabels) as ProviderId[]).map((provider) => (
                    <optgroup key={provider} label={providerLabels[provider]}>
                      {MODELS.filter((entry) => entry.provider === provider).map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="field">
                <div className="field-heading"><label>Prompt type</label></div>
                <select value={activeSurface.id} onChange={(event) => chooseSurface(event.target.value)}>
                  {surfaces.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.product} {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={needsPlan ? "two-column-fields target-options" : "target-options-single"}>
              {needsPlan ? (
                <div className="field">
                  <div className="field-heading">
                    <label>Plan</label>
                    <span>Resolves the official character limit</span>
                  </div>
                  <select
                    value={plan}
                    onChange={(event) =>
                      patchDraft({
                        target: {
                          ...activeDraft.target,
                          plan: event.target.value as PlanId
                        }
                      })
                    }
                  >
                    {plans.map((entry) => (
                      <option key={entry.value} value={entry.value}>{entry.label}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="field">
                <div className="field-heading">
                  <label>Optimization</label>
                  <span>Controls compression before export</span>
                </div>
                <select
                  value={optimization}
                  onChange={(event) =>
                    patchDraft({
                      target: {
                        ...activeDraft.target,
                        optimization: event.target.value as PromptOptimization
                      }
                    })
                  }
                >
                  <option value="balanced">Balanced</option>
                  <option value="compact">Compact</option>
                  <option value="maximum-fidelity">Maximum fidelity</option>
                </select>
              </div>
            </div>

            <dl className="target-facts">
              <div><dt>Context</dt><dd>{formatTokens(activeModel.contextWindowTokens)}</dd></div>
              <div><dt>Max output</dt><dd>{formatTokens(activeModel.maxOutputTokens)}</dd></div>
              <div><dt>Role</dt><dd>{activeSurface.instructionRole}</dd></div>
            </dl>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Prompt brief</h2>
              <p>Describe intent and constraints. Humanizer owns the structure.</p>
            </div>

            <div className="field">
              <div className="field-heading"><label>What should this prompt do?</label></div>
              <textarea
                rows={5}
                value={activeDraft.brief.goal}
                placeholder="Describe the task in plain language."
                onChange={(event) => updateBrief("goal", event.target.value)}
              />
            </div>

            <div className="field">
              <div className="field-heading"><label>Context</label><span>Optional</span></div>
              <textarea
                rows={3}
                value={activeDraft.brief.context}
                placeholder="Information the model should know before it starts."
                onChange={(event) => updateBrief("context", event.target.value)}
              />
            </div>

            <div className="two-column-fields prompt-detail-grid">
              <div className="field">
                <div className="field-heading"><label>Expected output</label><span>Optional</span></div>
                <textarea
                  rows={3}
                  value={activeDraft.brief.output}
                  placeholder="What a good result should contain."
                  onChange={(event) => updateBrief("output", event.target.value)}
                />
              </div>

              <div className="field">
                <div className="field-heading"><label>Constraints</label><span>Optional</span></div>
                <textarea
                  rows={3}
                  value={activeDraft.brief.constraints}
                  placeholder="Hard requirements or exclusions."
                  onChange={(event) => updateBrief("constraints", event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="panel compact-summary-panel">
            <div className="panel-heading">
              <h2>Behavior profile</h2>
              <p>The draft keeps its own profile reference.</p>
            </div>

            <div className="field">
              <select
                aria-label="Behavior profile"
                value={activeProfile.id}
                onChange={(event) => patchDraft({ profileId: event.target.value })}
              >
                {profiles.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </div>

            <dl className="target-facts">
              <div><dt>Naturalness</dt><dd>{activeProfile.profile.communication.naturalness}</dd></div>
              <div><dt>Directness</dt><dd>{activeProfile.profile.communication.directness}</dd></div>
              <div><dt>Research</dt><dd>{activeProfile.profile.research.rigor}</dd></div>
            </dl>
          </section>
        </div>

        <aside className="preview-panel">
          <div className="preview-header">
            <div>
              <h2>Output</h2>
              <p className={result.status === "overflow" ? "status error" : "status"}>{status}</p>
            </div>
            <div className="preview-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => downloadCompiledPrompt(activeDraft.name, result.text)}
              >
                Export
              </button>
              <button className="secondary-button" type="button" onClick={copyPrompt}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="count-row">
            <span>
              {result.characterLimit === null
                ? result.characterCount.toLocaleString() + " characters"
                : result.characterCount.toLocaleString() + " / " + result.characterLimit.toLocaleString() + " characters"}
            </span>
            {result.compactedBlocks.length ? <span>{result.compactedBlocks.length} compacted</span> : null}
          </div>

          <pre className="prompt-output">{result.text}</pre>

          {result.warnings.length ? (
            <div className="warnings">
              {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}

          <div className="source-note studio-source-note">
            <a href={activeModel.source.url} target="_blank" rel="noreferrer">Model source</a>
            <a href={activeSurface.source.url} target="_blank" rel="noreferrer">Target source</a>
          </div>
        </aside>
      </div>
    </main>
  )
}
