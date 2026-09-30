import { useEffect, useState } from "react"
import {
  updateProfileDocument,
  type BehaviorProfile,
  type ProfileDocument,
  type PromptPurpose
} from "@humanizer/core"
import { createSeedProfiles, DEFAULT_BEHAVIOR } from "./defaults"
import ProfilesView from "./ProfilesView"
import PromptStudioView from "./PromptStudioView"
import SettingsView from "./SettingsView"
import {
  loadActiveProfileId,
  loadProfiles,
  saveActiveProfileId,
  saveProfiles
} from "./profile-storage"

type View = "humanize" | "studio" | "profiles" | "test" | "integrations" | "settings"

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

  const nav: Array<{ id: View; label: string; disabled?: boolean }> = [
    { id: "humanize", label: "Humanize" },
    { id: "studio", label: "Prompt Studio" },
    { id: "profiles", label: "Profiles" },
    { id: "test", label: "Test", disabled: true },
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
              disabled={item.disabled}
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={item.disabled ? undefined : () => setView(item.id)}
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

        {view === "studio" ? <PromptStudioView profile={profile} /> : null}

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
