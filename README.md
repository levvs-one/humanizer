# Humanizer

Humanizer is a behavior layer for AI.

It turns a human description of how an assistant should think, research, write, and act into model-specific instructions for ChatGPT, Claude, Gemini, APIs, and agent runtimes.

The project is deliberately not a text spinner and not an AI-detector bypass tool. Humanizer works earlier in the pipeline: it defines behavior before generation.

## Product

Humanizer has two primary surfaces.

**Humanize** builds reusable behavior profiles: role, communication style, research policy, initiative, uncertainty handling, tool use, and writing constraints.

**Prompt Studio** compiles those profiles for a specific provider and target surface. A ChatGPT custom instruction, an API developer message, a Claude system prompt, and a Gemini system instruction are treated as different targets with different capabilities and limits.

## Principles

- Human intent is the source of truth.
- Profiles are structured data, not saved prompt blobs.
- Platform limits are explicit and source-backed.
- Unknown limits stay unknown; the app does not invent numbers.
- Compression preserves behavior, not wording.
- Research policy is separate from writing style.
- A professional role defines standards and decision style, not a fake biography.
- The interface uses hierarchy, spacing, and typography instead of decorative punctuation.
- No AI-generated SaaS visual language: no gradient theater, badge walls, or ornamental noise.

## Architecture

```text
Human intent
    ↓
Behavior profile
    ↓
Prompt IR
    ↓
Provider adapter
    ↓
Constraint optimizer
    ↓
Validator
    ↓
Target prompt
```

The first implementation is a TypeScript monorepo with a Tauri desktop shell, React interface, a provider/surface registry, and a deterministic prompt compiler.

## Repository

```text
apps/
  desktop/        Tauri desktop application

packages/
  core/           Behavior model, registry, compiler, validation

docs/
  architecture.md
  design.md
  registry.md
  adding-a-target.md
  export-formats.md
  provider-runtime.md
```

## Development

Requirements:

- Node.js 22+
- pnpm 10+
- Rust stable for the Tauri shell

```bash
pnpm install
pnpm dev
```

Checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Status

Humanizer is in alpha. The core desktop workflow is operational: profiles and prompt drafts persist locally, Prompt Studio compiles against source-backed model and surface metadata, inspects the result, exports target-aware artifacts, and can execute supported API targets through the native credential boundary.

Test and Integrations remain intentionally disabled in the interface until their underlying runtime workflows are real rather than placeholder screens.

## Contributing

Small, source-backed compatibility additions are welcome. The cleanest first contribution is usually a new target surface with official documentation and a regression test. See `CONTRIBUTING.md` and `docs/adding-a-target.md`.

## License

MIT
