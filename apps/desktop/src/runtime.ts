import { invoke } from "@tauri-apps/api/core"
import type { ProviderId } from "@humanizer/core"

export interface ExecutePromptRequest {
  provider: ProviderId
  model: string
  instructionRole: "persistent" | "developer" | "system" | "user"
  prompt: string
  runtimeInput?: string
}

export interface ExecutePromptResponse {
  provider: ProviderId
  model: string
  text: string
  inputTokens: number | null
  outputTokens: number | null
}

export interface TokenCountResponse {
  provider: ProviderId
  model: string
  inputTokens: number
}

export function supportsExactTokenPreflight(provider: ProviderId): boolean {
  return provider === "anthropic" || provider === "google"
}

export async function executeProviderPrompt(
  request: ExecutePromptRequest
): Promise<ExecutePromptResponse> {
  return invoke<ExecutePromptResponse>("execute_provider_prompt", {
    request
  })
}

export async function countProviderTokens(
  request: ExecutePromptRequest
): Promise<TokenCountResponse> {
  return invoke<TokenCountResponse>("count_provider_tokens", {
    request
  })
}
