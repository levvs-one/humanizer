# Command-line interface

Humanizer includes a small Node.js CLI for deterministic prompt compilation in terminals and CI.

The CLI uses the same core registry, profile parser, compiler, inspector, optimizer, and target exporter as the desktop app. It does not call provider APIs and does not read desktop credentials.

## Build

From the repository root:

```bash
pnpm install
pnpm --filter @humanizer/cli build
```

Run the bundled executable with:

```bash
node apps/cli/dist/index.js help
```

When installed or linked as a package, the binary name is `humanizer`.

## Discover registry ids

List known models:

```bash
humanizer models
humanizer models --json
```

List known prompt targets:

```bash
humanizer targets
humanizer targets --json
```

The plain-text forms are tab-separated so they remain useful in shell pipelines.

## Compile

Compile an independent exported profile:

```bash
humanizer compile \
  --profile ./principal-engineer.humanizer.json \
  --surface openai-api-developer \
  --model gpt-5.6-sol \
  --task "Review this implementation and propose the smallest safe fix." \
  --optimization balanced
```

Optional task fields:

- `--context <text>`
- `--output <text>`
- `--constraints <text>`
- `--purpose general|engineering|research|writing|agent`
- `--plan free|go|plus|pro|business|enterprise|education`
- `--optimization compact|balanced|maximum-fidelity`

By default the compiled prompt is written to stdout. Warnings and diagnostics go to stderr, so stdout can be piped safely.

Use `--out <file>` to write the result to a file.

## Target-aware artifact output

`--artifact` emits the same target-aware artifact used by Prompt Studio exports.

For example, an API developer/system target emits the corresponding JSON fragment instead of only the compiled text:

```bash
humanizer compile \
  --profile ./principal-engineer.humanizer.json \
  --surface anthropic-api-system \
  --model claude-sonnet-5 \
  --artifact \
  --out ./claude-system.json
```

## Reproduce Prompt Studio scopes

The CLI can compile the same scoped behavior stack as Prompt Studio:

```text
profile
  + project overrides
  + model-specific project overrides
  + draft/task overrides
  = effective behavior
```

Provide the exported profile, project, and draft together:

```bash
humanizer compile \
  --profile ./principal-engineer.humanizer.json \
  --project ./payments.humanizer-project.json \
  --draft ./retry-review.humanizer-prompt.json
```

The draft supplies its target, model, optimization, and task brief unless explicit CLI flags override them. This makes matrix compilation straightforward:

```bash
humanizer compile \
  --profile ./principal-engineer.humanizer.json \
  --project ./payments.humanizer-project.json \
  --draft ./retry-review.humanizer-prompt.json \
  --model claude-sonnet-5 \
  --surface anthropic-api-system
```

Document references are strict. If a draft names a profile or project id, the supplied files must match those ids. Humanizer fails with exit code 1 instead of silently dropping a scope or compiling against the wrong profile.

A project can also be supplied without a draft to apply reusable project and model overrides to CLI task flags.

## Profile inheritance

The CLI intentionally refuses unresolved derived profiles.

A derived desktop profile depends on other local profile documents. Compiling only that one file outside the desktop app would silently lose inherited behavior. Export or detach it as an independent profile before using it with the CLI.

## Exit codes

- `0`: compilation succeeded.
- `1`: invalid CLI arguments, registry id, or input file.
- `2`: compilation completed but has a blocking diagnostic or cannot fit the verified target limit.

Use `--quiet` to suppress non-blocking warnings and diagnostics on stderr.
