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

export async function executeProviderPrompt(
  request: ExecutePromptRequest
): Promise<ExecutePromptResponse> {
  return invoke<ExecutePromptResponse>("execute_provider_prompt", {
    request
  })
}
