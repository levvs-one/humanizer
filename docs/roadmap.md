# Roadmap

The roadmap is ordered by dependency, not by visual appeal.

## Core product

- structured behavior profiles
- local profile persistence
- live profile inheritance with local field overrides
- source-backed target registry
- source-backed model registry
- deterministic Prompt IR compiler
- character-budget optimizer
- Humanize editor
- model-aware Prompt Studio
- task briefs for chat, user, system, developer, and persistent instructions
- persistent prompt drafts with import and export
- target-aware text and API-fragment exports
- deterministic Prompt Inspector
- secure provider credential storage
- credential verification
- native OpenAI, Anthropic, and Gemini execution adapters
- exact provider token preflight where a supported counting endpoint exists

## Next

- project and model-specific profile overrides
- model-specific compiler refinements
- streaming and cancellation for provider execution
- reusable conversation runtime
- MCP server
- CLI

## Later

- Test and comparison workspace
- evaluation corpus and regression diagnostics
- optional signed registry updates
- optional cloud sync
- shared profiles
- web application

The Test navigation item stays disabled until the core generation and runtime workflows are complete. Humanizer should not expose a screen that looks finished before the underlying workflow is real.
