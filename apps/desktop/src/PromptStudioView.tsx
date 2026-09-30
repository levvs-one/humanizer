import { useMemo, useState } from "react"
import {
  compilePrompt,
  MODELS,
  SURFACES,
  type BehaviorProfile,
  type PlanId,
  type PromptBrief,
  type ProviderId
} from "@humanizer/core"

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
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(value % 1_000_000 ? 2 : 0) + "M tokens"
  if (value >= 1_000) return Math.round(value / 1_000) + "K tokens"
  return value.toLocaleString() + " tokens"
}

export default function PromptStudioView({ profile }: { profile: BehaviorProfile }) {
  const firstModel = MODELS[0]
  const firstSurface = SURFACES[0]

  if (!firstModel || !firstSurface) {
    throw new Error("Prompt Studio registry is empty.")
  }

  const [modelId, setModelId] = useState(firstModel.id)
  const [surfaceId, setSurfaceId] = useState(firstSurface.id)
  const [plan, setPlan] = useState<PlanId>("plus")
  const [brief, setBrief] = useState<PromptBrief>({
    goal: "",
    context: "",
    output: "",
    constraints: ""
  })
  const [copied, setCopied] = useState(false)

  const model = MODELS.find((entry) => entry.id === modelId) ?? firstModel
  const surfaces = SURFACES.filter((entry) => entry.provider === model.provider)
  const surface = surfaces.find((entry) => entry.id === surfaceId) ?? surfaces[0]

  if (!surface) {
    throw new Error("No prompt surface for selected model.")
  }

  const needsPlan = surface.characterLimit.kind === "by-plan"

  const result = useMemo(
    () =>
      compilePrompt({
        profile,
        brief,
        target: {
          surfaceId: surface.id,
          modelId: model.id,
          ...(needsPlan ? { plan } : {})
        }
      }),
    [profile, brief, surface.id, model.id, needsPlan, plan]
  )

  function chooseModel(nextId: string) {
    const next = MODELS.find((entry) => entry.id === nextId)
    if (!next) return

    setModelId(next.id)
    const compatible = SURFACES.find((entry) => entry.provider === next.provider)
    if (compatible) setSurfaceId(compatible.id)
    setCopied(false)
  }

  function updateBrief(field: keyof PromptBrief, value: string) {
    setBrief((current) => ({ ...current, [field]: value }))
    setCopied(false)
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
      <header className="page-header">
        <h1>Prompt Studio</h1>
        <p>Choose a model and prompt type, describe the job, and compile it with the active behavior profile.</p>
      </header>

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
                <select value={model.id} onChange={(event) => chooseModel(event.target.value)}>
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
                <select value={surface.id} onChange={(event) => setSurfaceId(event.target.value)}>
                  {surfaces.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.product} — {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {needsPlan ? (
              <div className="field compact-field">
                <div className="field-heading">
                  <label>Plan</label>
                  <span>Resolves the official character limit</span>
                </div>
                <select value={plan} onChange={(event) => setPlan(event.target.value as PlanId)}>
                  {plans.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <dl className="target-facts">
              <div><dt>Context</dt><dd>{formatTokens(model.contextWindowTokens)}</dd></div>
              <div><dt>Max output</dt><dd>{formatTokens(model.maxOutputTokens)}</dd></div>
              <div><dt>Role</dt><dd>{surface.instructionRole}</dd></div>
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
                value={brief.goal}
                placeholder="Describe the task in plain language."
                onChange={(event) => updateBrief("goal", event.target.value)}
              />
            </div>

            <div className="field">
              <div className="field-heading"><label>Context</label><span>Optional</span></div>
              <textarea
                rows={3}
                value={brief.context}
                placeholder="Information the model should know before it starts."
                onChange={(event) => updateBrief("context", event.target.value)}
              />
            </div>

            <div className="two-column-fields prompt-detail-grid">
              <div className="field">
                <div className="field-heading"><label>Expected output</label><span>Optional</span></div>
                <textarea
                  rows={3}
                  value={brief.output}
                  placeholder="What a good result should contain."
                  onChange={(event) => updateBrief("output", event.target.value)}
                />
              </div>

              <div className="field">
                <div className="field-heading"><label>Constraints</label><span>Optional</span></div>
                <textarea
                  rows={3}
                  value={brief.constraints}
                  placeholder="Hard requirements or exclusions."
                  onChange={(event) => updateBrief("constraints", event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="panel compact-summary-panel">
            <div className="panel-heading">
              <h2>Behavior profile</h2>
              <p>{profile.role}</p>
            </div>
            <dl className="target-facts">
              <div><dt>Naturalness</dt><dd>{profile.communication.naturalness}</dd></div>
              <div><dt>Directness</dt><dd>{profile.communication.directness}</dd></div>
              <div><dt>Research</dt><dd>{profile.research.rigor}</dd></div>
            </dl>
          </section>
        </div>

        <aside className="preview-panel">
          <div className="preview-header">
            <div>
              <h2>Output</h2>
              <p className={result.status === "overflow" ? "status error" : "status"}>{status}</p>
            </div>
            <button className="secondary-button" type="button" onClick={copyPrompt}>
              {copied ? "Copied" : "Copy"}
            </button>
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
            <a href={model.source.url} target="_blank" rel="noreferrer">Model source</a>
            <a href={surface.source.url} target="_blank" rel="noreferrer">Target source</a>
          </div>
        </aside>
      </div>
    </main>
  )
}
