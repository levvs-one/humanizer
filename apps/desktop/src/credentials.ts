import { invoke } from "@tauri-apps/api/core"

export type CredentialProvider = "openai" | "anthropic" | "google"

export interface CredentialStatus {
  provider: CredentialProvider
  configured: boolean
}

export async function getCredentialStatus(): Promise<CredentialStatus[]> {
  return invoke<CredentialStatus[]>("provider_credential_status")
}

export async function saveProviderApiKey(
  provider: CredentialProvider,
  apiKey: string
): Promise<void> {
  await invoke("set_provider_api_key", {
    provider,
    apiKey
  })
}

export async function deleteProviderApiKey(
  provider: CredentialProvider
): Promise<void> {
  await invoke("delete_provider_api_key", {
    provider
  })
}
