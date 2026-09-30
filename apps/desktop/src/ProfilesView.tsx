import { useRef, useState } from "react"
import {
  createProfileDocument,
  duplicateProfileDocument,
  parseProfileDocument,
  type BehaviorProfile,
  type ProfileDocument
} from "@humanizer/core"
import { DEFAULT_BEHAVIOR } from "./defaults"
import { downloadProfile } from "./profile-storage"

interface ProfilesViewProps {
  profiles: ProfileDocument[]
  activeProfileId: string
  onUse: (profileId: string) => void
  onCreate: (profile: ProfileDocument) => void
  onDelete: (profileId: string) => void
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown"
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date)
}

function createBlankBehavior(): BehaviorProfile {
  return structuredClone(DEFAULT_BEHAVIOR)
}

export default function ProfilesView({
  profiles,
  activeProfileId,
  onUse,
  onCreate,
  onDelete
}: ProfilesViewProps) {
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function createNewProfile() {
    const document = createProfileDocument({
      name: "Untitled Profile",
      description: "A new behavior profile.",
      profile: createBlankBehavior()
    })

    onCreate(document)
    onUse(document.id)
  }

  function duplicate(profile: ProfileDocument) {
    const document = duplicateProfileDocument(profile)
    onCreate(document)
    onUse(document.id)
  }

  async function importProfile(file: File | undefined) {
    if (!file) {
      return
    }

    try {
      const imported = parseProfileDocument(await file.text())
      const idCollision = profiles.some((profile) => profile.id === imported.id)
      const document = idCollision
        ? createProfileDocument({
            name: imported.name,
            description: imported.description,
            profile: imported.profile
          })
        : imported

      onCreate(document)
      onUse(document.id)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not import this profile.")
    } finally {
      if (fileInput.current) {
        fileInput.current.value = ""
      }
    }
  }

  return (
    <main className="page">
      <header className="page-header profile-page-header">
        <div>
          <h1>Profiles</h1>
          <p>
            Save behavior once, then compile it for different models and instruction surfaces.
          </p>
        </div>

        <div className="header-actions">
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept=".json,.humanizer.json,application/json"
            onChange={(event) => void importProfile(event.target.files?.[0])}
          />
          <button
            className="secondary-button"
            type="button"
            onClick={() => fileInput.current?.click()}
          >
            Import
          </button>
          <button className="primary-button" type="button" onClick={createNewProfile}>
            New profile
          </button>
        </div>
      </header>

      {error ? <div className="inline-error">{error}</div> : null}

      <section className="profiles-list" aria-label="Saved profiles">
        {profiles.map((profile) => {
          const active = profile.id === activeProfileId

          return (
            <article className={active ? "profile-row active-profile" : "profile-row"} key={profile.id}>
              <div className="profile-row-main">
                <div className="profile-row-title">
                  <h2>{profile.name}</h2>
                  {active ? <span>Active</span> : null}
                </div>
                <p>{profile.description || "No description"}</p>
                <dl className="profile-row-meta">
                  <div>
                    <dt>Role</dt>
                    <dd>{profile.profile.role}</dd>
                  </div>
                  <div>
                    <dt>Purpose</dt>
                    <dd>{profile.profile.purpose}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatUpdatedAt(profile.updatedAt)}</dd>
                  </div>
                </dl>
              </div>

              <div className="profile-row-actions">
                {!active ? (
                  <button className="secondary-button" type="button" onClick={() => onUse(profile.id)}>
                    Use
                  </button>
                ) : null}
                <button className="plain-button" type="button" onClick={() => duplicate(profile)}>
                  Duplicate
                </button>
                <button className="plain-button" type="button" onClick={() => downloadProfile(profile)}>
                  Export
                </button>
                {profiles.length > 1 ? (
                  <button
                    className="plain-button danger"
                    type="button"
                    onClick={() => onDelete(profile.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
