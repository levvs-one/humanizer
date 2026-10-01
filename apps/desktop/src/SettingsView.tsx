import {
  findStaleModelSources,
  findStaleTargetSources,
  MODELS,
  SURFACES
} from "@humanizer/core"
import { useEffect, useMemo, useState } from "react"
import {
  deleteProviderApiKey,
  getCredentialStatus,
  saveProviderApiKey,
  verifyProviderApiKey,
  type CredentialProvider,
  type CredentialStatus
} from "./credentials"

interface ProviderDefinition {
  id: CredentialProvider
  name: string
  description: string
  keyHint: string
}

function currentUtcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

const PROVIDERS: ProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Used for OpenAI API models and Responses API execution.",
    keyHint: "OpenAI API key"
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Used for Claude API requests.",
    keyHint: "Anthropic API key"
  },
  {
    id: "google",
    name: "Google",
    description: "Used for Gemini API requests.",
    keyHint: "Gemini API key"
  }
]

function ProviderCredentialRow({
  provider,
  configured,
  onChanged
}: {
  provider: ProviderDefinition
  configured: boolean
  onChanged: () => Promise<void>
}) {
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    if (!value.trim()) {
      setMessage("Enter an API key first.")
      return
    }

    setBusy(true)
    setMessage(null)

    try {
      await saveProviderApiKey(provider.id, value)
      setValue("")
      await onChanged()
      setMessage("Saved to the system credential store.")
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setMessage(null)

    try {
      await deleteProviderApiKey(provider.id)
      setValue("")
      await onChanged()
      setMessage("Credential removed.")
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }


  async function verify() {
    setBusy(true)
    setMessage(null)

    try {
      const result = await verifyProviderApiKey(provider.id)
      setMessage(result.message)
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="provider-row">
      <div className="provider-copy">
        <div className="provider-heading">
          <h2>{provider.name}</h2>
          <span className={configured ? "credential-state configured" : "credential-state"}>
            {configured ? "Configured" : "Not configured"}
          </span>
        </div>
        <p>{provider.description}</p>
      </div>

      <div className="provider-controls">
        <input
          aria-label={provider.keyHint}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={configured ? "Stored securely" : provider.keyHint}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void save()
            }
          }}
        />

        <div className="provider-actions">
          <button
            className="primary-button"
            type="button"
            disabled={busy}
            onClick={() => void save()}
          >
            {configured ? "Replace" : "Save"}
          </button>

          {configured ? (
            <>
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => void verify()}
              >
                Verify
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => void remove()}
              >
                Remove
              </button>
            </>
          ) : null}
        </div>

        {message ? <p className="provider-message">{message}</p> : null}
      </div>
    </section>
  )
}

export default function SettingsView() {
  const [statuses, setStatuses] = useState<CredentialStatus[]>([])
  const [utcDay, setUtcDay] = useState(currentUtcDay)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const configured = useMemo(
    () => new Map(statuses.map((status) => [status.provider, status.configured])),
    [statuses]
  )

  const staleTargets = useMemo(
    () => findStaleTargetSources(SURFACES, utcDay, 90),
    [utcDay]
  )
  const staleModels = useMemo(
    () => findStaleModelSources(MODELS, utcDay, 90),
    [utcDay]
  )
  const staleRegistryEntries = useMemo(
    () => [
      ...staleModels.map((entry) => ({
        kind: "model" as const,
        id: entry.modelId,
        verifiedAt: entry.verifiedAt,
        ageDays: entry.ageDays
      })),
      ...staleTargets.map((entry) => ({
        kind: "surface" as const,
        id: entry.targetId,
        verifiedAt: entry.verifiedAt,
        ageDays: entry.ageDays
      }))
    ].sort((left, right) => right.ageDays - left.ageDays),
    [staleModels, staleTargets]
  )

  async function refresh() {
    try {
      setStatuses(await getCredentialStatus())
      setError(null)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Secure credential storage is unavailable in this environment."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    function refreshUtcDay() {
      setUtcDay(currentUtcDay())
    }

    function scheduleRollover(): ReturnType<typeof window.setTimeout> {
      const now = new Date()
      const nextUtcMidnight = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1
      )

      return window.setTimeout(() => {
        refreshUtcDay()
        rolloverTimer = scheduleRollover()
      }, Math.max(1_000, nextUtcMidnight - now.getTime() + 100))
    }

    let rolloverTimer = scheduleRollover()

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshUtcDay()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", refreshUtcDay)

    return () => {
      window.clearTimeout(rolloverTimer)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", refreshUtcDay)
    }
  }, [])

  return (
    <main className="page">
      <header className="page-header">
        <h1>Settings</h1>
        <p>
          Provider credentials stay in the operating system credential store. Humanizer never
          reads them back into the interface after saving.
        </p>
      </header>

      <div className="settings-layout">
        <section className="settings-section">
          <div className="settings-section-heading">
            <h2>Provider credentials</h2>
            <p>
              Stored in Keychain on macOS, Credential Manager on Windows, and Secret Service on
              Linux.
            </p>
          </div>

          {error ? <div className="inline-error">{error}</div> : null}

          <div className="provider-list" aria-busy={loading}>
            {PROVIDERS.map((provider) => (
              <ProviderCredentialRow
                key={provider.id}
                provider={provider}
                configured={configured.get(provider.id) ?? false}
                onChanged={refresh}
              />
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading">
            <h2>Registry health</h2>
            <p>
              Model and target metadata are source-backed. Entries older than 90 days are
              flagged for re-verification instead of being silently treated as current forever.
            </p>
          </div>

          {staleRegistryEntries.length === 0 ? (
            <p className="prompt-inspector-empty">
              All {MODELS.length} models and {SURFACES.length} target surfaces were verified
              within the last 90 days.
            </p>
          ) : (
            <div className="provider-list">
              {staleRegistryEntries.map((entry) => {
                const source =
                  entry.kind === "model"
                    ? MODELS.find((candidate) => candidate.id === entry.id)
                    : SURFACES.find((candidate) => candidate.id === entry.id)

                if (!source) return null

                const title =
                  entry.kind === "model"
                    ? source.label
                    : "product" in source
                      ? source.product + " " + source.label
                      : source.label

                return (
                  <section
                    className="provider-row"
                    key={entry.kind + ":" + entry.id}
                  >
                    <div className="provider-copy">
                      <div className="provider-heading">
                        <h2>{title}</h2>
                        <span className="credential-state">
                          {entry.ageDays} days old
                        </span>
                      </div>
                      <p>
                        {entry.kind === "model" ? "Model metadata" : "Target metadata"} verified{" "}
                        {entry.verifiedAt}. Re-check the official source before changing limits
                        or capabilities.
                      </p>
                    </div>

                    <div className="provider-controls">
                      <a
                        className="secondary-button"
                        href={source.source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Official source
                      </a>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section-heading">
            <h2>Privacy</h2>
            <p>
              Profiles stay local. Provider keys are not written to localStorage, profile exports,
              logs, or analytics.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
