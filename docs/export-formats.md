# Export formats

Prompt Studio exports the compiled prompt in the format that best matches the selected target.

The export layer deliberately avoids generating a complete API request when doing so would require inventing unrelated values such as output limits, tools, or user input.

## Product surfaces

ChatGPT Custom Instructions, ChatGPT Projects, Claude Projects, Gemini Gems, Gemini Personal Instructions, and normal chat prompts export as plain text.

## OpenAI API

Developer instructions export as a Responses API fragment:

```json
{
  "instructions": "..."
}
```

User prompts export as:

```json
{
  "input": "..."
}
```

Official reference:
https://platform.openai.com/docs/api-reference/responses

Verified: 2026-09-30

## Anthropic API

System prompts export as:

```json
{
  "system": "..."
}
```

User prompts export as:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "..."
    }
  ]
}
```

Official reference:
https://docs.anthropic.com/en/api/messages

Verified: 2026-09-30

## Gemini API

System instructions export as:

```json
{
  "system_instruction": {
    "parts": [
      {
        "text": "..."
      }
    ]
  }
}
```

User prompts export as:

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "..."
        }
      ]
    }
  ]
}
```

Official reference:
https://ai.google.dev/api/generate-content

Verified: 2026-09-30

## Rule

Exports are request fragments, not generated boilerplate applications.

Humanizer should never guess API keys, output token counts, tool definitions, safety settings, or application-specific runtime values just to make an export look more complete.
