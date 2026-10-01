# Provider runtime

Prompt Studio can execute compiled prompts directly against supported provider APIs.

The runtime is intentionally native. API keys stay in the operating-system credential store and are read only by the Rust layer when a request is sent.

## Supported providers

### OpenAI

Endpoint:

```text
POST https://api.openai.com/v1/responses
```

Authentication uses an HTTP Bearer token.

User prompt surfaces map to `input`. Developer or system-style instructions map to `instructions` and require separate runtime input.

Humanizer sends `store: false`.

Official references:

- https://platform.openai.com/docs/api-reference/responses
- https://platform.openai.com/docs/api-reference/authentication

Verified: 2026-09-30

## Anthropic

Endpoint:

```text
POST https://api.anthropic.com/v1/messages
```

Authentication uses `x-api-key` and `anthropic-version: 2023-06-01`.

User prompt surfaces become a user message. System instruction surfaces map to the top-level `system` field and require separate runtime input.

Claude 5 uses adaptive thinking by default. Humanizer does not disable it. The runtime therefore leaves a 16,000-token output ceiling for the manual Studio run instead of forcing a smaller reasoning budget.

Official references:

- https://docs.anthropic.com/en/api/messages
- https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables

Verified: 2026-09-30

## Gemini

Endpoint:

```text
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

Authentication uses the `x-goog-api-key` header.

User prompt surfaces map to `contents`. System instruction surfaces map to `system_instruction` plus separate user contents.

Official references:

- https://ai.google.dev/api/generate-content
- https://ai.google.dev/api

Verified: 2026-09-30

## Streaming and cancellation

Manual API runs stream visible text into Prompt Studio as it arrives.

Humanizer uses Tauri IPC channels between the native runtime and the webview. Provider wire formats remain inside the Rust layer.

- OpenAI Responses runs use `stream: true` and consume `response.output_text.delta` events.
- Anthropic Messages runs use `stream: true` and consume only `text_delta` content blocks. Thinking deltas are not forwarded to the interface.
- Gemini uses `streamGenerateContent?alt=sse` and consumes streamed `GenerateContentResponse` chunks.

Each run receives a unique local run id. Cancel signals the native request immediately. The Rust runtime races that signal against both the initial HTTP request and each pending SSE read, so a cancelled run does not wait for the provider to send another chunk before releasing the stream. Run state is removed whether the stream completes, fails, or is cancelled.

Official references:

- https://developers.openai.com/api/docs/guides/streaming-responses
- https://platform.claude.com/docs/en/build-with-claude/streaming
- https://ai.google.dev/api/generate-content
- https://v2.tauri.app/fr/develop/calling-frontend/

Verified: 2026-09-30

## Output budget

Prompt Studio can optionally set a maximum output-token budget for an API run.

- OpenAI Responses receives `max_output_tokens`.
- Anthropic Messages receives `max_tokens`.
- Gemini receives `generationConfig.maxOutputTokens`.
- Leaving the field blank preserves provider behavior; Anthropic keeps Humanizer's existing 16,000-token runtime default because the Messages API requires `max_tokens`.
- Studio rejects non-positive values and values above the selected model's source-backed `maxOutputTokens` metadata.
- Exact input token-count requests intentionally omit output-generation settings.

## Provider-native web research

Prompt Studio can make the selected provider's own web-search tool available for an API run when the effective behavior profile allows tools.

The runtime maps one Humanizer switch to each provider's native API shape:

- OpenAI Responses: `tools: [{ "type": "web_search" }]`.
- Anthropic Messages: `web_search_20260318` with `allowed_callers: ["direct"]` and `max_uses: 5`.
- Gemini Generate Content: `tools: [{ "google_search": {} }]`.

The provider still decides whether a search is useful for a particular request. Humanizer does not synthesize search results or proxy search traffic through its own server.

The effective tool policy is a hard local boundary:

- `tools.usage = "off"` disables provider web research in Studio.
- `when-useful` and `proactive` make the native search tool available by default; the user can turn it off for an individual run.
- search availability is included in the exact token-preflight signature so stale counts are not reused across different tool configurations.

Search calls can have provider-specific billing.

### Research citations

Provider search citations are returned through the native runtime as structured source records and rendered as clickable links in Prompt Studio.

- OpenAI URL citation annotations are collected from Responses output and streaming annotation events.
- Anthropic `web_search_result_location` citations are collected from message content and `citations_delta` stream events.
- Gemini web grounding chunks are collected from `groundingMetadata.groundingChunks`.

Duplicate source URLs are collapsed within a run. For multi-turn Studio sessions, assistant-message source links are saved alongside the local assistant text, so a restarted desktop session does not lose the source list.

Humanizer currently renders a provider-neutral clickable Sources list. Provider-specific inline claim-to-source placement can be added later without changing the stored citation schema.

Official references:

- https://developers.openai.com/api/docs/guides/tools-web-search
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- https://platform.claude.com/docs/en/build-with-claude/citations
- https://ai.google.dev/gemini-api/docs/generate-content/google-search

Verified: 2026-10-01

## Conversation history

Instruction-style API targets can carry local multi-turn history.

Humanizer saves validated conversation history locally on the device and sends prior user/assistant turns using each provider's native request shape:

- OpenAI Responses receives ordered input messages while the compiled behavior remains in `instructions`.
- Anthropic Messages receives ordered `user` and `assistant` messages while the compiled behavior remains in `system`.
- Gemini receives ordered `user` and `model` contents while the compiled behavior remains in `system_instruction`.

User-prompt surfaces remain single-turn. Humanizer does not reinterpret a compiled user prompt as a persistent system instruction just to force conversation semantics.

## Data handling

For instruction-style API targets, completed multi-turn responses are saved in versioned local conversation storage so a Studio session can survive an app restart. Failed and cancelled runs are not added to history.

Conversation storage is bounded: Humanizer retains at most 30 local sessions and 100 messages per session. Clearing a conversation removes that session from local storage.

If browser-local storage is unavailable or a write fails, the active conversation continues in memory and Prompt Studio reports that the session is not being persisted instead of interrupting the run.

The runtime returns response text and provider-reported token usage to the webview. The saved API key is never returned.

Provider retention and data-processing behavior remains subject to the provider account and API policies.

## Scope

This runtime is for manually executing a compiled prompt from Prompt Studio.

This is still a lightweight Studio runtime rather than the final agent runtime. Multi-turn message history, durable local Studio sessions, and provider-native web research are supported for instruction-style API targets. Rich multi-step research routing, client-side tools, MCP execution, and agent loops remain separate runtime layers.


## Token preflight

Humanizer can ask the provider to count the exact request context before execution where the provider exposes a supported counting endpoint.

### Anthropic

Humanizer uses:

```text
POST https://api.anthropic.com/v1/messages/count_tokens
```

The payload mirrors the selected system or user prompt shape. For system instructions, the count includes the explicit runtime input because that input is part of the request context.

### Gemini

Humanizer uses:

```text
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:countTokens
```

The request wraps the same `generateContentRequest` shape used for execution so system instructions and runtime input are counted together.

### OpenAI

Humanizer does not display an estimated preflight token count for OpenAI.

Until the runtime has an exact supported mechanism for the selected OpenAI model, the UI shows character limits where those are verified and provider-reported token usage after a real run. A character-to-token guess would look precise while being wrong across languages, models, and prompt structure.

Token preflight is never a replacement for a verified hard surface limit. Character constraints and model context limits remain separate concepts.
