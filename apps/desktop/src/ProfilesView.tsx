import { useRef, useState } from "react"
import {
  createDerivedProfileDocument,
  createProfileDocument,
  detachProfileDocument,
  duplicateProfileDocument,
  materializeProfileDocument,
  parseProfileDocument,
  resetProfileInheritance,
  resolveProfileDocument,
  updateProfileDocument,
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
  onUpdate: (profile: ProfileDocument) => void
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
  onUpdate,
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
    const document = duplicateProfileDocument(profile, { documents: profiles })
    onCreate(document)
    onUse(document.id)
  }

  function derive(profile: ProfileDocument) {
    const document = createDerivedProfileDocument(profile, profiles)
    onCreate(document)
    onUse(document.id)
  }

  function detach(profile: ProfileDocument) {
    onUpdate(detachProfileDocument(profile, profiles))
  }

  function reset(profile: ProfileDocument) {
    onUpdate(resetProfileInheritance(profile, profiles))
  }

  function exportProfile(profile: ProfileDocument) {
    downloadProfile(materializeProfileDocument(profile, profiles))
  }

  async function importProfile(file: File | undefined) {
    if (!file) {
      return
    }

    try {
      const imported = parseProfileDocument(await file.text())
      const portable = materializeProfileDocument(imported, [...profiles, imported])
      const idCollision = profiles.some((profile) => profile.id === portable.id)
      const document = idCollision
        ? createProfileDocument({
            name: portable.name,
            description: portable.description,
            profile: portable.profile
          })
        : portable

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
            Build base behavior once, then derive focused variants that keep following it until a field is overridden.
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
          const resolved = resolveProfileDocument(profile, profiles)
          const base = profile.baseProfileId
            ? profiles.find((entry) => entry.id === profile.baseProfileId)
            : undefined
          const overrideCount =
            profile.baseProfileId === null
              ? 0
              : 17 - profile.inheritedFields.length

          return (
            <article
              className={active ? "profile-row active-profile" : "profile-row"}
              key={profile.id}
            >
              <div className="profile-row-main">
                <div className="profile-row-title">
                  <input
                    className="profile-name-input"
                    aria-label={"Profile name for " + profile.name}
                    value={profile.name}
                    onChange={(event) =>
                      onUpdate(updateProfileDocument(profile, { name: event.target.value }))
                    }
                  />
                  {active ? <span>Active</span> : null}
                </div>

                <input
                  className="profile-description-input"
                  aria-label={"Profile description for " + profile.name}
                  value={profile.description}
                  placeholder="Add a short description"
                  onChange={(event) =>
                    onUpdate(
                      updateProfileDocument(profile, {
                        description: event.target.value
                      })
                    )
                  }
                />

                {base ? (
                  <p className="profile-inheritance-summary">
                    Based on {base.name}
                    {overrideCount > 0
                      ? " with " + overrideCount + " local " +
                        (overrideCount === 1 ? "override" : "overrides")
                      : ""}
                  </p>
                ) : null}

                <dl className="profile-row-meta">
                  <div>
                    <dt>Role</dt>
                    <dd>{resolved.role}</dd>
                  </div>
                  <div>
                    <dt>Purpose</dt>
                    <dd>{resolved.purpose}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatUpdatedAt(profile.updatedAt)}</dd>
                  </div>
                </dl>
              </div>

              <div className="profile-row-actions">
                {!active ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onUse(profile.id)}
                  >
                    Use
                  </button>
                ) : null}

                <button className="plain-button" type="button" onClick={() => derive(profile)}>
                  Derive
                </button>

                <button className="plain-button" type="button" onClick={() => duplicate(profile)}>
                  Duplicate
                </button>

                {profile.baseProfileId ? (
                  <>
                    {overrideCount > 0 ? (
                      <button className="plain-button" type="button" onClick={() => reset(profile)}>
                        Reset overrides
                      </button>
                    ) : null}
                    <button className="plain-button" type="button" onClick={() => detach(profile)}>
                      Detach
                    </button>
                  </>
                ) : null}

                <button className="plain-button" type="button" onClick={() => exportProfile(profile)}>
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
