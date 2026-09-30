# Architecture

Humanizer stores behavior as structured data and compiles it for a target surface. Prompt text is an output artifact, never the source of truth.

## Pipeline

```text
Human intent
    ↓
Behavior profile
    ↓
Prompt IR
    ↓
Target surface
    ↓
Provider adapter
    ↓
Constraint optimizer
    ↓
Validator
    ↓
Prompt
```

## Core objects

### Behavior profile

A behavior profile describes role, communication, research, uncertainty handling, initiative, writing style, and tool policy. Profiles can later inherit from other profiles without copying prompt text.

### Target surface

A target surface is more specific than a model. It identifies the product and the exact place where instructions will be used.

Examples:

- ChatGPT Custom Instructions
- OpenAI API developer instruction
- Anthropic API system prompt
- Gemini API system instruction

Each surface owns its verified limits, supported capabilities, source URL, and verification date.

### Prompt IR

Prompt IR is the stable intermediate representation between user intent and provider-specific text. The compiler can change wording without changing the profile schema.

### Constraint optimizer

Known character limits are enforced deterministically. The optimizer first replaces lower-priority blocks with compact variants, then removes optional blocks. It never slices text in the middle of an instruction.

If critical intent cannot fit, compilation reports that honestly instead of silently truncating it.

## Boundaries

The initial desktop app is local-first. API keys will live in the operating-system credential store when provider calls are introduced. Humanizer servers are not required to proxy model traffic.

Remote services are reserved for signed registry updates, optional sync, releases, and opt-in diagnostics.

## Future packages

The monorepo is intentionally small at the start. Split packages only when boundaries become real:

- provider adapters
- tokenizer integrations
- profile persistence
- evaluation harness
- MCP server
- research policy engine

Premature package count is not architecture.
