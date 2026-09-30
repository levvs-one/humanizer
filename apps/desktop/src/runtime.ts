import { Channel, invoke } from "@tauri-apps/api/core"
import type { ProviderId } from "@humanizer/core"

export interface RuntimeMessage {
  role: "user" | "assistant"
  text: string
}

export interface ExecutePromptRequest {
  provider: ProviderId
  model: string
  instructionRole: "persistent" | "developer" | "system" | "user"
  prompt: string
  runtimeInput?: string
  history?: RuntimeMessage[]
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

export type ProviderStreamEvent =
  | { event: "started"; data: { runId: string } }
  | { event: "delta"; data: { text: string } }
  | {
      event: "usage"
      data: {
        inputTokens: number | null
        outputTokens: number | null
      }
    }
  | { event: "error"; data: { message: string } }
  | { event: "finished"; data: { cancelled: boolean } }

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

export async function streamProviderPrompt(
  request: ExecutePromptRequest,
  runId: string,
  onEvent: (event: ProviderStreamEvent) => void
): Promise<void> {
  const channel = new Channel<ProviderStreamEvent>()
  channel.onmessage = onEvent

  await invoke("stream_provider_prompt", {
    request,
    runId,
    onEvent: channel
  })
}

export async function cancelProviderStream(runId: string): Promise<boolean> {
  return invoke<boolean>("cancel_provider_stream", { runId })
}

export async function countProviderTokens(
  request: ExecutePromptRequest
): Promise<TokenCountResponse> {
  return invoke<TokenCountResponse>("count_provider_tokens", {
    request
  })
}
