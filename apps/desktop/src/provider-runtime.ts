import { invoke } from "@tauri-apps/api/core"
import type { ProviderId } from "@humanizer/core"

export interface PromptTokenCount {
  provider: ProviderId
  model: string
  totalTokens: number
}

export async function countPromptTokens(
  provider: ProviderId,
  model: string,
  text: string
): Promise<PromptTokenCount> {
  return invoke<PromptTokenCount>("count_prompt_tokens", {
    provider,
    model,
    text
  })
}
