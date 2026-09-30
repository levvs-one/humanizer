import { useEffect, useMemo, useState } from "react"
import {
  compilePrompt,
  SURFACES,
  updateProfileDocument,
  type BehaviorProfile,
  type PlanId,
  type ProfileDocument,
  type PromptPurpose
} from "@humanizer/core"
import { createSeedProfiles, DEFAULT_BEHAVIOR } from "./defaults"
import ProfilesView from "./ProfilesView"
import SettingsView from "./SettingsView"
import {
  loadActiveProfileId,
  loadProfiles,
  saveActiveProfileId,
  saveProfiles
} from "./profile-storage"

type View = "humanize" | "studio" | "profiles" | "test" | "integrations" | "settings"

const planOptions: Array<{ value: PlanId; label: string }> = [
  { value: "free", label: "Free" },
  { value: "go", label: "Go" },
  { value: "plus", label: "Plus" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
  { value: "enterprise", label: "Enterprise" },
  { value: "education", label: "Education" }
]

const purposeOptions: Array<{ value: PromptPurpose; label: string }> = [
  { value: "general", label: "General" },
  { value: "engineering", label: "Engineering" },
  { value: "research", label: "Research" },
  { value: "writing", label: "Writing" },
  { value: "agent", label: "Agent" }
]

function updateNestedProfile(
  profile: BehaviorProfile,
  patch: Partial<BehaviorProfile>
): BehaviorProfile {
  return { ...profile, ...patch }
}

function FieldLabel({
  title,
  hint
}: {
  title: string
  hint?: string
}) {
  return (
    <div className="field-heading">
      <label>{title}</label>
      {hint ? <span>{hint}</span> : null}
    </div>
  )
}

function RangeField({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="range-field">
      <div className="range-heading">
        <label>{label}</label>
        <span>{value}</span>
      </div>
      <input
        aria-label={label}
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

function HumanizeView({
  profile,
  setProfile,
  openStudio
}: {
  profile: BehaviorProfile
  setProfile: (profile: BehaviorProfile) => void
  openStudio: () => void
}) {
  return (
    <main className="page">
      <header className="page-header">
        <h1>Humanize</h1>
        <p>
          Define how the model should work. The profile stays structured so it can be compiled
          cleanly for different products later.
        </p>
      </header>

      <div className="profile-layout">
        <section className="panel">
          <div className="panel-heading">
            <h2>Identity</h2>
            <p>Set professional standards without inventing a biography.</p>
          </div>

          <div className="field">
            <FieldLabel title="Role" />
            <input
              value={profile.role}
              onChange={(event) =>
                setProfile(updateNestedProfile(profile, { role: event.target.value }))
              }
            />
          </div>

          <div className="field">
            <FieldLabel
              title="Objective"
              hint="What this assistant should optimize for"
            />
            <textarea
              rows={5}
              value={profile.objective}
              onChange={(event) =>
                setProfile(updateNestedProfile(profile, { objective: event.target.value }))
              }
            />
          </div>

          <div className="field">
            <FieldLabel title="Purpose" />
            <select
              value={profile.purpose}
              onChange={(event) =>
                setProfile(
                  updateNestedProfile(profile, {
                    purpose: event.target.value as PromptPurpose
                  })
                )
              }
            >
              {purposeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Behavior</h2>
            <p>These values describe behavior. They are not pasted into prompts as raw scores.</p>
          </div>

          <div className="range-stack">
            <RangeField
              label="Naturalness"
              value={profile.communication.naturalness}
              onChange={(value) =>
                setProfile({
                  ...profile,
                  communication: { ...profile.communication, naturalness: value }
                })
              }
            />
            <RangeField
              label="Directness"
              value={profile.communication.directness}
              onChange={(value) =>
                setProfile({
                  ...profile,
                  communication: { ...profile.communication, directness: value }
                })
              }
            />
            <RangeField
              label="Research rigor"
              value={profile.research.rigor}
              onChange={(value) =>
                setProfile({
                  ...profile,
                  research: { ...profile.research, rigor: value }
                })
              }
            />
          </div>

          <div className="field compact-field">
            <FieldLabel title="Verbosity" />
            <select
              value={profile.communication.verbosity}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  communication: {
                    ...profile.communication,
                    verbosity: event.target.value as BehaviorProfile["communication"]["verbosity"]
                  }
                })
              }
            >
              <option value="low">Compact</option>
              <option value="medium">Balanced</option>
              <option value="high">Detailed</option>
            </select>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Research and writing</h2>
            <p>Control evidence quality separately from the voice of the response.</p>
          </div>

          <div className="toggle-list">
            <ToggleRow
              label="Prefer primary sources"
              description="Documentation and first-party material come first."
              checked={profile.research.preferPrimarySources}
              onChange={(checked) =>
                setProfile({
                  ...profile,
                  research: { ...profile.research, preferPrimarySources: checked }
                })
              }
            />
            <ToggleRow
              label="Allow community sources"
              description="Use forums for practical experience, not as verified fact."
              checked={profile.research.allowCommunitySources}
              onChange={(checked) =>
                setProfile({
                  ...profile,
                  research: { ...profile.research, allowCommunitySources: checked }
                })
              }
            />
            <ToggleRow
              label="Remove AI filler"
              description="Avoid canned openings, repeated conclusions, and mechanical structure."
              checked={profile.writing.avoidAISlop}
              onChange={(checked) =>
                setProfile({
                  ...profile,
                  writing: { ...profile.writing, avoidAISlop: checked }
                })
              }
            />
            <ToggleRow
              label="Use headings only when useful"
              description="Structure should follow the content, not a template."
              checked={profile.writing.avoidUnnecessaryHeadings}
              onChange={(checked) =>
                setProfile({
                  ...profile,
                  writing: { ...profile.writing, avoidUnnecessaryHeadings: checked }
                })
              }
            />
          </div>
        </section>

        <div className="page-action">
          <button className="primary-button" type="button" onClick={openStudio}>
            Open Prompt Studio
          </button>
        </div>
      </div>
    </main>
  )
}

function PromptStudio({
  profile
}: {
  profile: BehaviorProfile
}) {
  const products = useMemo(
    () => Array.from(new Set(SURFACES.map((surface) => surface.product))),
    []
  )
  const [product, setProduct] = useState("ChatGPT")
  const [surfaceId, setSurfaceId] = useState("chatgpt-custom-instructions")
  const [plan, setPlan] = useState<PlanId>("plus")
  const [result, setResult] = useState(() =>
    compilePrompt({
      profile,
      target: { surfaceId: "chatgpt-custom-instructions", plan: "plus" }
    })
  )
  const [copied, setCopied] = useState(false)

  const surfaces = SURFACES.filter((surface) => surface.product === product)
  const selectedSurface =
    SURFACES.find((surface) => surface.id === surfaceId) ?? surfaces[0] ?? SURFACES[0]

  if (!selectedSurface) {
    return null
  }

  const activeSurface = selectedSurface
  const needsPlan = activeSurface.characterLimit.kind === "by-plan"

  function handleProductChange(nextProduct: string) {
    const firstSurface = SURFACES.find((surface) => surface.product === nextProduct)
    if (!firstSurface) {
      return
    }
    setProduct(nextProduct)
    setSurfaceId(firstSurface.id)
  }

  function generate() {
    const target = needsPlan
      ? { surfaceId: activeSurface.id, plan }
      : { surfaceId: activeSurface.id }

    setResult(compilePrompt({ profile, target }))
    setCopied(false)
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(result.text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const countText =
    result.characterLimit === null
      ? result.characterCount.toLocaleString() + " characters"
      : result.characterCount.toLocaleString() +
        " / " +
        result.characterLimit.toLocaleString() +
        " characters"

  const statusText =
    result.status === "fits"
      ? "Fits target"
      : result.status === "overflow"
        ? "Does not fit"
        : "No verified hard character limit"

  return (
    <main className="page">
      <header className="page-header">
        <h1>Prompt Studio</h1>
        <p>
          Compile the active behavior profile for the exact place where the instructions will be
          used.
        </p>
      </header>

      <div className="studio-layout">
        <div className="studio-controls">
          <section className="panel">
            <div className="panel-heading">
              <h2>Target</h2>
              <p>Product and instruction surface determine the available budget.</p>
            </div>

            <div className="two-column-fields">
              <div className="field">
                <FieldLabel title="Product" />
                <select
                  value={product}
                  onChange={(event) => handleProductChange(event.target.value)}
                >
                  {products.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <FieldLabel title="Surface" />
                <select
                  value={activeSurface.id}
                  onChange={(event) => setSurfaceId(event.target.value)}
                >
                  {surfaces.map((surface) => (
                    <option key={surface.id} value={surface.id}>
                      {surface.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {needsPlan ? (
              <div className="field compact-field">
                <FieldLabel title="Plan" hint="Used only to resolve the official limit" />
                <select value={plan} onChange={(event) => setPlan(event.target.value as PlanId)}>
                  {planOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="source-note">
              <span>Verified {activeSurface.source.verifiedAt}</span>
              <a href={activeSurface.source.url} target="_blank" rel="noreferrer">
                {activeSurface.source.label}
              </a>
            </div>
          </section>

          <section className="panel summary-panel">
            <div className="panel-heading">
              <h2>Active profile</h2>
              <p>The compiler reads structured behavior, not a saved prompt blob.</p>
            </div>

            <dl className="profile-summary">
              <div>
                <dt>Role</dt>
                <dd>{profile.role}</dd>
              </div>
              <div>
                <dt>Purpose</dt>
                <dd>{purposeOptions.find((option) => option.value === profile.purpose)?.label}</dd>
              </div>
              <div>
                <dt>Naturalness</dt>
                <dd>{profile.communication.naturalness}</dd>
              </div>
              <div>
                <dt>Research</dt>
                <dd>{profile.research.rigor}</dd>
              </div>
            </dl>
          </section>

          <button className="primary-button full-width" type="button" onClick={generate}>
            Compile prompt
          </button>
        </div>

        <aside className="preview-panel">
          <div className="preview-header">
            <div>
              <h2>Output</h2>
              <p className={result.status === "overflow" ? "status error" : "status"}>
                {statusText}
              </p>
            </div>
            <button className="secondary-button" type="button" onClick={copyPrompt}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="count-row">
            <span>{countText}</span>
            {result.compactedBlocks.length > 0 ? (
              <span>{result.compactedBlocks.length} compacted</span>
            ) : null}
          </div>

          <pre className="prompt-output">{result.text}</pre>

          {result.warnings.length > 0 ? (
            <div className="warnings">
              {result.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  )
}

function PendingView({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <main className="page">
      <header className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <section className="empty-state">
        <h2>Foundation first</h2>
        <p>
          This area is part of the product architecture. It will be implemented after the compiler
          and profile model are stable enough to depend on.
        </p>
      </section>
    </main>
  )
}

export default function App() {
  const [view, setView] = useState<View>("humanize")
  const [profiles, setProfiles] = useState<ProfileDocument[]>(() => {
    const stored = loadProfiles()
    return stored.length > 0 ? stored : createSeedProfiles()
  })
  const [activeProfileId, setActiveProfileId] = useState(
    () => loadActiveProfileId() ?? "principal-engineer"
  )

  const activeDocument =
    profiles.find((document) => document.id === activeProfileId) ?? profiles[0]
  const activeId = activeDocument?.id ?? ""
  const profile = activeDocument?.profile ?? DEFAULT_BEHAVIOR

  useEffect(() => {
    saveProfiles(profiles)
  }, [profiles])

  useEffect(() => {
    if (activeId) {
      saveActiveProfileId(activeId)
    }
  }, [activeId])

  function setProfile(nextProfile: BehaviorProfile) {
    if (!activeDocument) {
      return
    }

    setProfiles((current) =>
      current.map((document) =>
        document.id === activeDocument.id
          ? updateProfileDocument(document, { profile: nextProfile })
          : document
      )
    )
  }

  function addProfile(document: ProfileDocument) {
    setProfiles((current) => [...current, document])
  }

  function updateDocument(nextDocument: ProfileDocument) {
    setProfiles((current) =>
      current.map((document) =>
        document.id === nextDocument.id ? nextDocument : document
      )
    )
  }

  function deleteProfile(profileId: string) {
    setProfiles((current) => {
      if (current.length <= 1) {
        return current
      }

      const next = current.filter((document) => document.id !== profileId)

      if (profileId === activeId && next[0]) {
        setActiveProfileId(next[0].id)
      }

      return next
    })
  }

  const nav: Array<{ id: View; label: string }> = [
    { id: "humanize", label: "Humanize" },
    { id: "studio", label: "Prompt Studio" },
    { id: "profiles", label: "Profiles" },
    { id: "test", label: "Test" },
    { id: "integrations", label: "Integrations" }
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="wordmark" type="button" onClick={() => setView("humanize")}>
          Humanizer
        </button>

        <nav aria-label="Primary">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className={view === "settings" ? "nav-item active settings-link" : "nav-item settings-link"}
          onClick={() => setView("settings")}
        >
          Settings
        </button>
      </aside>

      <div className="content">
        {view === "humanize" ? (
          <HumanizeView
            profile={profile}
            setProfile={setProfile}
            openStudio={() => setView("studio")}
          />
        ) : null}

        {view === "studio" ? <PromptStudio profile={profile} /> : null}

        {view === "profiles" ? (
          <ProfilesView
            profiles={profiles}
            activeProfileId={activeId}
            onUse={setActiveProfileId}
            onCreate={addProfile}
            onUpdate={updateDocument}
            onDelete={deleteProfile}
          />
        ) : null}

        {view === "test" ? (
          <PendingView
            title="Test"
            description="Compare baseline and compiled behavior using concrete differences instead of a magic score."
          />
        ) : null}

        {view === "integrations" ? (
          <PendingView
            title="Integrations"
            description="Provider APIs, MCP, and local tools will share the same behavior profile and target registry."
          />
        ) : null}

        {view === "settings" ? <SettingsView /> : null}
      </div>
    </div>
  )
}
