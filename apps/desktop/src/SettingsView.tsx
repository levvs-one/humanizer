import { useEffect, useMemo, useState } from "react"
import {
  deleteProviderApiKey,
  getCredentialStatus,
  saveProviderApiKey,
  type CredentialProvider,
  type CredentialStatus
} from "./credentials"

interface ProviderDefinition {
  id: CredentialProvider
  name: string
  description: string
  keyHint: string
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
            <button
              className="secondary-button"
              type="button"
              disabled={busy}
              onClick={() => void remove()}
            >
              Remove
            </button>
          ) : null}
        </div>

        {message ? <p className="provider-message">{message}</p> : null}
      </div>
    </section>
  )
}

export default function SettingsView() {
  const [statuses, setStatuses] = useState<CredentialStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const configured = useMemo(
    () => new Map(statuses.map((status) => [status.provider, status.configured])),
    [statuses]
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
