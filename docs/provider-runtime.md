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

## Data handling

Humanizer does not persist provider responses from manual Studio runs.

The runtime returns response text and provider-reported token usage to the webview. The saved API key is never returned.

Provider retention and data-processing behavior remains subject to the provider account and API policies.

## Scope

This runtime is for manually executing a compiled prompt from Prompt Studio.

It is not the future Humanizer conversation runtime. Multi-turn state, tools, research routing, streaming, and agent loops belong to the runtime layer that will build on the same native adapters.
