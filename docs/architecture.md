# Architecture

Humanizer stores behavior as structured data and compiles it for a target surface. Prompt text is an output artifact, never the source of truth.

## Pipeline

```text
Human intent
    ↓
Behavior profile
    ↓
Task brief
    ↓
Prompt IR
    ↓
Model + target surface
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

Prompt IR is the stable intermediate representation between user intent and provider-specific text. Prompt IR v2 combines the active behavior profile with an optional task brief containing the task, context, expected output, and hard constraints.

The renderer can change ordering and syntax by target. User prompts put the task first. Persistent, system, and developer instructions put behavior first. Provider formatting can also differ without changing the profile schema.

### Constraint optimizer

Known character limits are enforced deterministically. The optimizer first replaces lower-priority blocks with compact variants, then removes optional blocks. It never slices text in the middle of an instruction.

If critical intent cannot fit, compilation reports that honestly instead of silently truncating it.

## Boundaries

The desktop app is local-first. Provider API keys live in the operating-system credential store and are read only by the native Tauri layer when a provider request is sent. Saved keys are never returned to the React interface.

Prompt Studio can execute compiled prompts directly through native OpenAI, Anthropic, and Gemini adapters. Humanizer servers are not required to proxy model traffic.

Where a provider exposes a supported token-count endpoint, the same native layer can perform exact preflight counting. Humanizer does not substitute heuristic character-to-token estimates when an exact count is unavailable.

Remote services are reserved for signed registry updates, optional sync, releases, and opt-in diagnostics.

## Future packages

The monorepo is intentionally small at the start. Split packages only when boundaries become real:

- conversation runtime
- profile inheritance
- evaluation harness
- MCP server
- research policy engine

Premature package count is not architecture.
