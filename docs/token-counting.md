# Token counting

Humanizer separates character limits from token budgets.

A product field can have a hard character limit while an API model has a token context window. The two are not interchangeable.

## Provider counting

For API targets, Humanizer can ask the model provider to tokenize the compiled prompt text before generation when the provider exposes a documented preflight endpoint.

### Anthropic

Humanizer uses:

```text
POST /v1/messages/count_tokens
```

The compiled prompt is submitted as one user message solely for tokenization. Anthropic returns `input_tokens`.

Official reference:
https://platform.claude.com/docs/en/api/messages/count_tokens

Verified: 2026-09-30

### Gemini

Humanizer uses:

```text
POST /v1beta/models/{model}:countTokens
```

The compiled prompt is submitted as one text content block. Gemini returns `totalTokens`.

Official reference:
https://ai.google.dev/api/tokens

Verified: 2026-09-30

### OpenAI

Humanizer currently records exact preflight token counting as unavailable for OpenAI models.

We do not substitute a character heuristic and label it as an exact token count. If OpenAI documents a suitable preflight endpoint or a verified tokenizer contract for the current model family, it can be added as a model capability.

## Scope

The number shown in Prompt Studio is the provider's token count for the compiled prompt text sent through the counting request. A later execution request may include additional application input, tools, files, conversation history, or provider framing.

Humanizer therefore calls this value **Input tokens**, not total request size.

Token counting is manual rather than automatic on every edit. Editing a prompt invalidates the previous count. This avoids sending prompt text to a provider merely because the user typed into an editor.

## Privacy

Token counting uses the API key already stored in the operating-system credential store. The key never enters the React frontend.

Prompt text is sent only when the user explicitly chooses **Count tokens**.
