import { useEffect, useRef, useState } from "react"
import {
  applyBehaviorOverrideLayers,
  buildTargetExport,
  compilePrompt,
  createProjectDocument,
  createPromptDraftDocument,
  duplicatePromptDraftDocument,
  MODELS,
  parsePromptDraftDocument,
  SURFACES,
  updatePromptDraftDocument,
  type BehaviorFieldPath,
  type BehaviorOverrideValue,
  type PlanId,
  type ProfileDocument,
  type ProjectDocument,
  type PromptBrief,
  type PromptDiagnostic,
  type PromptDraftDocument,
  type PromptOptimization,
  type PromptPurpose,
  type ProviderId
} from "@humanizer/core"
import {
  createConversationSessionKey,
  loadConversationSessions,
  removeConversationSession,
  saveConversationSessions,
  upsertConversationSession,
  type ConversationSession
} from "./conversation-storage"
import {
  downloadCompiledPrompt,
  downloadPromptDraft,
  loadActivePromptDraftId,
  loadPromptDrafts,
  saveActivePromptDraftId,
  savePromptDrafts
} from "./prompt-draft-storage"
import ProjectScopePanel from "./ProjectScopePanel"
import {
  loadProjects,
  saveProjects
} from "./project-storage"
import {
  cancelProviderStream,
  countProviderTokens,
  streamProviderPrompt,
  supportsExactTokenPreflight,
  type ExecutePromptResponse
} from "./runtime"

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


function createRunId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  return "run-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
}


function PromptInspector({ diagnostics }: { diagnostics: PromptDiagnostic[] }) {
  return (
    <section className="prompt-inspector" aria-label="Prompt inspector">
      <div className="prompt-inspector-heading">
        <h3>Inspector</h3>
        <span>{diagnostics.length === 0 ? "No issues" : diagnostics.length + " found"}</span>
      </div>

      {diagnostics.length === 0 ? (
        <p className="prompt-inspector-empty">No structural issues found.</p>
      ) : (
        <div className="prompt-diagnostic-list">
          {diagnostics.map((diagnostic, index) => (
            <div
              className={"prompt-diagnostic " + diagnostic.severity}
              key={diagnostic.code + "-" + index}
            >
              <p>{diagnostic.message}</p>
              <span>{diagnostic.severity}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
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
  const [projects, setProjects] = useState<ProjectDocument[]>(() => loadProjects())
  const [copied, setCopied] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [runInputs, setRunInputs] = useState<Record<string, string>>({})
  const [executing, setExecuting] = useState(false)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [countingTokens, setCountingTokens] = useState(false)
  const [tokenCountError, setTokenCountError] = useState<string | null>(null)
  const [tokenCount, setTokenCount] = useState<{
    signature: string
    inputTokens: number
  } | null>(null)
  const [execution, setExecution] = useState<{
    draftId: string
    modelId: string
    surfaceId: string
    response: ExecutePromptResponse
  } | null>(null)
  const [initialConversationStore] = useState(() => loadConversationSessions())
  const [conversationSessions, setConversationSessions] = useState<
    ConversationSession[]
  >(() => initialConversationStore.sessions)
  const [conversationStorageAvailable, setConversationStorageAvailable] =
    useState(initialConversationStore.storageAvailable)

  const draft = drafts.find((entry) => entry.id === activeDraftId) ?? drafts[0]

  useEffect(() => {
    savePromptDrafts(drafts)
  }, [drafts])

  useEffect(() => {
    if (draft?.id) {
      saveActivePromptDraftId(draft.id)
    }
  }, [draft?.id])

  useEffect(() => {
    saveProjects(projects)
  }, [projects])

  useEffect(() => {
    if (!conversationStorageAvailable) {
      return
    }

    if (!saveConversationSessions(conversationSessions)) {
      setConversationStorageAvailable(false)
    }
  }, [conversationSessions, conversationStorageAvailable])

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
  const activeProject =
    activeDraft.projectId === null
      ? null
      : projects.find((project) => project.id === activeDraft.projectId) ?? null
  const projectProfile = applyBehaviorOverrideLayers(
    activeProfile.profile,
    [activeProject?.behaviorOverrides ?? {}]
  )
  const effectiveProfile = applyBehaviorOverrideLayers(
    projectProfile,
    [activeDraft.behaviorOverrides]
  )
  const overrideCount = Object.keys(activeDraft.behaviorOverrides).length
  const activeSurface = surface
  const needsPlan = activeSurface.characterLimit.kind === "by-plan"
  const plan = activeDraft.target.plan ?? "plus"
  const optimization = activeDraft.target.optimization ?? "balanced"

  const result = compilePrompt({
    profile: effectiveProfile,
    brief: activeDraft.brief,
    target: {
      surfaceId: activeSurface.id,
      modelId: activeModel.id,
      ...(needsPlan ? { plan } : {}),
      optimization
    }
  })
  const targetExport = buildTargetExport(result)
  const isApiTarget = activeSurface.product.endsWith("API")
  const requiresRuntimeInput = activeSurface.instructionRole !== "user"
  const supportsConversation = isApiTarget && requiresRuntimeInput
  const runtimeInput = runInputs[activeDraft.id] ?? ""
  const conversationKey = createConversationSessionKey(
    activeDraft.id,
    activeModel.id,
    activeSurface.id,
    result.text
  )
  const conversationHistory =
    conversationSessions.find((session) => session.key === conversationKey)?.messages ?? []
  const currentExecution =
    execution &&
    execution.draftId === activeDraft.id &&
    execution.modelId === activeModel.id &&
    execution.surfaceId === activeSurface.id
      ? execution.response
      : null
  const tokenCountSignature = [
    activeDraft.id,
    activeModel.id,
    activeSurface.id,
    result.text,
    requiresRuntimeInput ? runtimeInput : "",
    JSON.stringify(conversationHistory)
  ].join("\u0000")
  const currentTokenCount =
    tokenCount?.signature === tokenCountSignature ? tokenCount.inputTokens : null
  const canPreflightTokens =
    isApiTarget &&
    supportsExactTokenPreflight(activeModel.provider) &&
    (!requiresRuntimeInput || runtimeInput.trim().length > 0)
  const hasBlockingDiagnostic = result.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error"
  )
  const canExecute =
    isApiTarget &&
    !hasBlockingDiagnostic &&
    (activeSurface.instructionRole !== "user" ||
      activeDraft.brief.goal.trim().length > 0) &&
    (!requiresRuntimeInput || runtimeInput.trim().length > 0)

  function replaceDraft(next: PromptDraftDocument) {
    setDrafts((current) =>
      current.map((entry) => (entry.id === next.id ? next : entry))
    )
    setCopied(false)
    setExecutionError(null)
    setTokenCountError(null)
  }

  function patchDraft(
    changes: Partial<
      Pick<
        PromptDraftDocument,
        "name" | "profileId" | "projectId" | "behaviorOverrides" | "target" | "brief"
      >
    >
  ) {
    replaceDraft(updatePromptDraftDocument(activeDraft, changes))
  }

  function createProject() {
    const project = createProjectDocument({
      name: "Untitled Project",
      description: "",
      behaviorOverrides: {}
    })
    setProjects((current) => [...current, project])
    patchDraft({ projectId: project.id })
  }

  function updateProject(project: ProjectDocument) {
    setProjects((current) =>
      current.map((entry) => (entry.id === project.id ? project : entry))
    )
  }

  function deleteProject(projectId: string) {
    setProjects((current) => current.filter((project) => project.id !== projectId))
    setDrafts((current) =>
      current.map((entry) =>
        entry.projectId === projectId
          ? updatePromptDraftDocument(entry, { projectId: null })
          : entry
      )
    )
  }

  function setBehaviorOverride(
    path: BehaviorFieldPath,
    value: BehaviorOverrideValue | undefined
  ) {
    const next = { ...activeDraft.behaviorOverrides }

    if (value === undefined) {
      delete next[path]
    } else {
      next[path] = value
    }

    patchDraft({ behaviorOverrides: next })
  }

  function numericBehaviorOverride(path: BehaviorFieldPath): string {
    const value = activeDraft.behaviorOverrides[path]
    return typeof value === "number" ? String(value) : ""
  }

  function scoreBehaviorOverride(value: string): number | undefined {
    if (value === "") {
      return undefined
    }

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      return undefined
    }

    return Math.max(0, Math.min(100, parsed))
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

  function updateBrief(
    field: "goal" | "context" | "output" | "constraints",
    value: string
  ) {
    patchDraft({
      brief: {
        ...activeDraft.brief,
        [field]: value
      }
    })
  }

  function choosePurpose(value: string) {
    const { purpose: _purpose, ...rest } = activeDraft.brief

    patchDraft({
      brief:
        value === ""
          ? rest
          : {
              ...rest,
              purpose: value as PromptPurpose
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
      const projectId =
        imported.projectId !== null &&
        projects.some((project) => project.id === imported.projectId)
          ? imported.projectId
          : null
      const collision = drafts.some((entry) => entry.id === imported.id)
      const next = collision
        ? createPromptDraftDocument({
            name: imported.name,
            profileId,
            projectId,
            behaviorOverrides: imported.behaviorOverrides,
            target: imported.target,
            brief: imported.brief
          })
        : updatePromptDraftDocument(imported, { profileId, projectId })

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

  async function countTokens() {
    if (!canPreflightTokens) return

    setCountingTokens(true)
    setTokenCountError(null)

    try {
      const response = await countProviderTokens({
        provider: activeModel.provider,
        model: activeModel.id,
        instructionRole: activeSurface.instructionRole,
        prompt: result.text,
        ...(requiresRuntimeInput ? { runtimeInput } : {}),
        ...(supportsConversation ? { history: conversationHistory } : {})
      })

      setTokenCount({
        signature: tokenCountSignature,
        inputTokens: response.inputTokens
      })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setTokenCountError(
        message.includes("No stored API key")
          ? "Configure this provider in Settings before counting tokens."
          : message
      )
    } finally {
      setCountingTokens(false)
    }
  }

  async function runPrompt() {
    if (!canExecute || executing) return

    const runId = createRunId()
    const runDraftId = activeDraft.id
    const runModelId = activeModel.id
    const runSurfaceId = activeSurface.id
    const runProvider = activeModel.provider
    const runRuntimeInput = runtimeInput.trim()
    const runConversationKey = conversationKey
    const runHistory = supportsConversation ? [...conversationHistory] : []
    let completedText = ""
    let runFailed = false

    setExecuting(true)
    setActiveRunId(runId)
    setExecutionError(null)
    setExecution({
      draftId: runDraftId,
      modelId: runModelId,
      surfaceId: runSurfaceId,
      response: {
        provider: runProvider,
        model: runModelId,
        text: "",
        inputTokens: null,
        outputTokens: null
      }
    })

    try {
      await streamProviderPrompt(
        {
          provider: runProvider,
          model: runModelId,
          instructionRole: activeSurface.instructionRole,
          prompt: result.text,
          ...(requiresRuntimeInput ? { runtimeInput: runRuntimeInput } : {}),
          ...(supportsConversation ? { history: runHistory } : {})
        },
        runId,
        (event) => {
          if (event.event === "delta") {
            completedText += event.data.text
            setExecution((current) => {
              if (
                !current ||
                current.draftId !== runDraftId ||
                current.modelId !== runModelId ||
                current.surfaceId !== runSurfaceId
              ) {
                return current
              }

              return {
                ...current,
                response: {
                  ...current.response,
                  text: current.response.text + event.data.text
                }
              }
            })
            return
          }

          if (event.event === "usage") {
            setExecution((current) => {
              if (
                !current ||
                current.draftId !== runDraftId ||
                current.modelId !== runModelId ||
                current.surfaceId !== runSurfaceId
              ) {
                return current
              }

              return {
                ...current,
                response: {
                  ...current.response,
                  inputTokens: event.data.inputTokens,
                  outputTokens: event.data.outputTokens
                }
              }
            })

            if (event.data.inputTokens !== null) {
              setTokenCount({
                signature: tokenCountSignature,
                inputTokens: event.data.inputTokens
              })
            }
            return
          }

          if (event.event === "error") {
            runFailed = true
            setExecutionError(event.data.message)
            return
          }

          if (event.event === "finished") {
            if (
              supportsConversation &&
              !event.data.cancelled &&
              !runFailed &&
              runRuntimeInput.length > 0 &&
              completedText.trim().length > 0
            ) {
              setConversationSessions((current) => {
                const existing =
                  current.find((session) => session.key === runConversationKey)?.messages ??
                  runHistory

                return upsertConversationSession(
                  current,
                  runConversationKey,
                  [
                    ...existing,
                    { role: "user", text: runRuntimeInput },
                    { role: "assistant", text: completedText.trim() }
                  ]
                )
              })
              setRunInputs((current) => ({
                ...current,
                [runDraftId]: ""
              }))
            }

            setExecuting(false)
            setActiveRunId((current) => (current === runId ? null : current))
          }
        }
      )
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setExecutionError(
        message.includes("No stored API key")
          ? "No API key is configured for this provider. Add one in Settings."
          : message
      )
    } finally {
      setExecuting(false)
      setActiveRunId((current) => (current === runId ? null : current))
    }
  }

  async function cancelRun() {
    if (!activeRunId) return

    try {
      await cancelProviderStream(activeRunId)
    } catch (reason) {
      setExecutionError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  function clearConversation() {
    setConversationSessions((current) =>
      removeConversationSession(current, conversationKey)
    )
    setExecution(null)
    setExecutionError(null)
    setTokenCount(null)
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
              <div className="field-heading">
                <label>Use case</label>
                <span>Changes the compiler's working strategy</span>
              </div>
              <select
                value={activeDraft.brief.purpose ?? ""}
                onChange={(event) => choosePurpose(event.target.value)}
              >
                <option value="">
                  Profile default ({effectiveProfile.purpose})
                </option>
                <option value="general">General</option>
                <option value="engineering">Engineering</option>
                <option value="research">Research</option>
                <option value="writing">Writing</option>
                <option value="agent">Agent</option>
              </select>
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

          <ProjectScopePanel
            projects={projects}
            activeProject={activeProject}
            baseProfile={activeProfile.profile}
            onSelect={(projectId) => patchDraft({ projectId })}
            onCreate={createProject}
            onUpdate={updateProject}
            onDelete={deleteProject}
          />

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
              <div><dt>Naturalness</dt><dd>{effectiveProfile.communication.naturalness}</dd></div>
              <div><dt>Directness</dt><dd>{effectiveProfile.communication.directness}</dd></div>
              <div><dt>Research</dt><dd>{effectiveProfile.research.rigor}</dd></div>
            </dl>

            <details className="advanced-behavior">
              <summary>
                Task behavior overrides{overrideCount > 0 ? " (" + overrideCount + ")" : ""}
              </summary>

              <div className="advanced-behavior-content">
                <div className="field">
                  <div className="field-heading">
                    <label>Role</label>
                    <span>Blank inherits the profile</span>
                  </div>
                  <input
                    value={
                      typeof activeDraft.behaviorOverrides.role === "string"
                        ? activeDraft.behaviorOverrides.role
                        : ""
                    }
                    placeholder={projectProfile.role}
                    onChange={(event) =>
                      setBehaviorOverride(
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
                      typeof activeDraft.behaviorOverrides.objective === "string"
                        ? activeDraft.behaviorOverrides.objective
                        : ""
                    }
                    placeholder={projectProfile.objective}
                    onChange={(event) =>
                      setBehaviorOverride(
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
                        typeof activeDraft.behaviorOverrides["communication.verbosity"] === "string"
                          ? String(activeDraft.behaviorOverrides["communication.verbosity"])
                          : ""
                      }
                      onChange={(event) =>
                        setBehaviorOverride(
                          "communication.verbosity",
                          event.target.value === "" ? undefined : event.target.value
                        )
                      }
                    >
                      <option value="">Inherited ({projectProfile.communication.verbosity})</option>
                      <option value="low">Compact</option>
                      <option value="medium">Balanced</option>
                      <option value="high">Detailed</option>
                    </select>
                  </div>

                  <div className="field">
                    <div className="field-heading"><label>Directness</label><span>0–100</span></div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={numericBehaviorOverride("communication.directness")}
                      placeholder={String(projectProfile.communication.directness)}
                      onChange={(event) =>
                        setBehaviorOverride(
                          "communication.directness",
                          scoreBehaviorOverride(event.target.value)
                        )
                      }
                    />
                  </div>
                </div>

                <div className="two-column-fields">
                  <div className="field">
                    <div className="field-heading"><label>Initiative</label><span>0–100</span></div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={numericBehaviorOverride("reasoning.initiative")}
                      placeholder={String(projectProfile.reasoning.initiative)}
                      onChange={(event) =>
                        setBehaviorOverride(
                          "reasoning.initiative",
                          scoreBehaviorOverride(event.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <div className="field-heading"><label>Verification</label><span>0–100</span></div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={numericBehaviorOverride("reasoning.verification")}
                      placeholder={String(projectProfile.reasoning.verification)}
                      onChange={(event) =>
                        setBehaviorOverride(
                          "reasoning.verification",
                          scoreBehaviorOverride(event.target.value)
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
                        typeof activeDraft.behaviorOverrides["tools.usage"] === "string"
                          ? String(activeDraft.behaviorOverrides["tools.usage"])
                          : ""
                      }
                      onChange={(event) =>
                        setBehaviorOverride(
                          "tools.usage",
                          event.target.value === "" ? undefined : event.target.value
                        )
                      }
                    >
                      <option value="">Inherited ({projectProfile.tools.usage})</option>
                      <option value="off">Off</option>
                      <option value="when-useful">When useful</option>
                      <option value="proactive">Proactive</option>
                    </select>
                  </div>

                  <div className="field">
                    <div className="field-heading"><label>External actions</label></div>
                    <select
                      value={
                        typeof activeDraft.behaviorOverrides["tools.confirmExternalActions"] === "boolean"
                          ? String(activeDraft.behaviorOverrides["tools.confirmExternalActions"])
                          : ""
                      }
                      onChange={(event) =>
                        setBehaviorOverride(
                          "tools.confirmExternalActions",
                          event.target.value === ""
                            ? undefined
                            : event.target.value === "true"
                        )
                      }
                    >
                      <option value="">
                        Inherited ({projectProfile.tools.confirmExternalActions ? "confirm" : "allowed"})
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
                      typeof activeDraft.behaviorOverrides["tools.preferReadOnly"] === "boolean"
                        ? String(activeDraft.behaviorOverrides["tools.preferReadOnly"])
                        : ""
                    }
                    onChange={(event) =>
                      setBehaviorOverride(
                        "tools.preferReadOnly",
                        event.target.value === ""
                          ? undefined
                          : event.target.value === "true"
                      )
                    }
                  >
                    <option value="">
                      Inherited ({projectProfile.tools.preferReadOnly ? "yes" : "no"})
                    </option>
                    <option value="true">Prefer read-only inspection</option>
                    <option value="false">No read-only preference</option>
                  </select>
                </div>

                <div className="field">
                  <div className="field-heading"><label>Research rigor</label><span>0–100</span></div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={numericBehaviorOverride("research.rigor")}
                    placeholder={String(projectProfile.research.rigor)}
                    onChange={(event) =>
                      setBehaviorOverride(
                        "research.rigor",
                        scoreBehaviorOverride(event.target.value)
                      )
                    }
                  />
                </div>

                {overrideCount > 0 ? (
                  <div className="runtime-actions">
                    <button
                      className="plain-button"
                      type="button"
                      onClick={() => patchDraft({ behaviorOverrides: {} })}
                    >
                      Reset task overrides
                    </button>
                    <span>The base profile is unchanged.</span>
                  </div>
                ) : null}
              </div>
            </details>
          </section>

          {isApiTarget ? (
            <section className="panel runtime-panel">
              <div className="panel-heading">
                <h2>Run</h2>
                <p>
                  Execute this compiled prompt with the selected API model. The stored key stays in the native credential layer.
                </p>
              </div>

              {requiresRuntimeInput ? (
                <div className="field">
                  <div className="field-heading">
                    <label>Runtime input</label>
                    <span>Sent as the user message</span>
                  </div>
                  <textarea
                    rows={3}
                    value={runtimeInput}
                    placeholder="What should the compiled instructions act on?"
                    onChange={(event) =>
                      setRunInputs((current) => ({
                        ...current,
                        [activeDraft.id]: event.target.value
                      }))
                    }
                  />
                </div>
              ) : null}

              {executionError ? (
                <p className="runtime-error">{executionError}</p>
              ) : null}

              <div className="runtime-actions">
                <button
                  className={executing ? "secondary-button" : "primary-button"}
                  type="button"
                  disabled={!executing && !canExecute}
                  onClick={() => void (executing ? cancelRun() : runPrompt())}
                >
                  {executing
                    ? "Cancel run"
                    : supportsConversation && conversationHistory.length > 0
                      ? "Continue with " + providerLabels[activeModel.provider]
                      : "Run with " + providerLabels[activeModel.provider]}
                </button>

                {supportsConversation && conversationHistory.length > 0 ? (
                  <button
                    className="plain-button"
                    type="button"
                    disabled={executing}
                    onClick={clearConversation}
                  >
                    Clear conversation
                  </button>
                ) : null}

                <span>
                  {supportsConversation
                    ? conversationHistory.length > 0
                      ? conversationHistory.length / 2 +
                        (conversationStorageAvailable
                          ? " turns saved locally."
                          : " turns in memory only.")
                      : conversationStorageAvailable
                        ? "Conversation history is saved locally on this device."
                        : "Local storage is unavailable; conversation history stays in memory."
                    : "Responses are not saved."}
                </span>
              </div>
            </section>
          ) : null}
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
                onClick={() => downloadCompiledPrompt(activeDraft.name, targetExport)}
              >
                {targetExport.format === "json" ? "Export JSON" : "Export text"}
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

            <div className="count-row-actions">
              {currentTokenCount !== null ? (
                <span>{currentTokenCount.toLocaleString()} input tokens</span>
              ) : null}
              {result.compactedBlocks.length ? (
                <span>{result.compactedBlocks.length} compacted</span>
              ) : null}
              {canPreflightTokens ? (
                <button
                  className="text-button"
                  type="button"
                  disabled={countingTokens}
                  onClick={() => void countTokens()}
                >
                  {countingTokens
                    ? "Counting"
                    : currentTokenCount === null
                      ? "Count tokens"
                      : "Recount"}
                </button>
              ) : null}
            </div>
          </div>

          {tokenCountError ? (
            <p className="token-count-error">{tokenCountError}</p>
          ) : null}

          <pre className="prompt-output">{result.text}</pre>

          <PromptInspector diagnostics={result.diagnostics} />

          {supportsConversation && conversationHistory.length > 0 ? (
            <section className="runtime-response conversation-response" aria-label="Conversation">
              <div className="runtime-response-heading">
                <h3>Conversation</h3>
                <span>{conversationHistory.length / 2} turns</span>
              </div>

              <div className="conversation-thread">
                {conversationHistory.map((message, index) => (
                  <div className={"conversation-message " + message.role} key={index}>
                    <strong>{message.role === "user" ? "You" : activeModel.label}</strong>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {currentExecution && (!supportsConversation || executing) ? (
            <section className="runtime-response" aria-label="Provider response">
              <div className="runtime-response-heading">
                <h3>Response</h3>
                <span>{activeModel.label}</span>
              </div>
              <pre>{currentExecution.text}</pre>
              {(currentExecution.inputTokens !== null ||
                currentExecution.outputTokens !== null) ? (
                <dl>
                  <div>
                    <dt>Input</dt>
                    <dd>
                      {currentExecution.inputTokens === null
                        ? "Not reported"
                        : currentExecution.inputTokens.toLocaleString() + " tokens"}
                    </dd>
                  </div>
                  <div>
                    <dt>Output</dt>
                    <dd>
                      {currentExecution.outputTokens === null
                        ? "Not reported"
                        : currentExecution.outputTokens.toLocaleString() + " tokens"}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </section>
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
