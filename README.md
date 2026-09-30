# Humanizer

Humanizer is a behavior layer for AI.

It turns a human description of how an assistant should think, research, write, and act into model-specific instructions for ChatGPT, Claude, Gemini, APIs, and agent runtimes.

The project is deliberately not a text spinner and not an AI-detector bypass tool. Humanizer works earlier in the pipeline: it defines behavior before generation.

## Product

Humanizer has two primary surfaces.

**Humanize** builds reusable behavior profiles: role, communication style, research policy, initiative, uncertainty handling, tool-use policy, reusable hard rules, and writing constraints. Profiles can derive from another profile with live field-level inheritance.

**Prompt Studio** compiles those profiles for a specific provider and target surface. Project scopes and task-level overrides specialize a profile without cloning it. A ChatGPT custom instruction, an API developer message, a Claude system prompt, and a Gemini system instruction are treated as different targets with different capabilities and limits.

For supported API targets, Prompt Studio can execute the compiled instructions directly, stream the response, continue a local multi-turn conversation, perform exact token preflight where the provider supports it, and persist bounded conversation history locally.

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
Project scope
    ↓
Task override
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

The implementation is a TypeScript monorepo with a Tauri desktop shell, React interface, a source-backed provider/surface registry, deterministic prompt compiler, native provider runtime, and local versioned documents for profiles, projects, drafts, and conversations.

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
  profiles.md
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

GitHub Actions runs these checks for every pull request. Native Rust/Tauri checks run separately when `apps/desktop/src-tauri/**` changes.

## Status

Humanizer is in alpha, but the core desktop workflow is operational end to end.

Profiles, project scopes, prompt drafts, and bounded conversation sessions persist locally. Behavior supports live inheritance, reusable hard rules, structured tool policy, project-level overrides, and narrower task overrides. Prompt Studio compiles against source-backed model and target metadata, reports stale registry entries, inspects and optimizes the result, exports target-aware artifacts, performs supported token preflight, and executes OpenAI, Anthropic, and Gemini API targets through the native credential boundary with streaming and cancellation.

Instruction-style API targets support local multi-turn continuation. Provider keys remain in the operating-system credential store and are never returned to the React interface.

Test and Integrations remain intentionally disabled until their underlying workflows are real rather than placeholder screens.

## Contributing

Small, source-backed compatibility additions are welcome. The cleanest first contribution is usually a new target surface with official documentation and a regression test. See `CONTRIBUTING.md` and `docs/adding-a-target.md`.

## License

MIT
