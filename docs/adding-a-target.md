# Adding a target

A target is one exact place where Humanizer instructions are used.

Good examples:

- ChatGPT Custom Instructions
- an API developer instruction
- a Claude project instruction
- a Gemini system instruction

A provider or model by itself is not a target.

## Before writing code

Find official documentation for the surface you want to add.

Record only limits that the provider actually documents. If you cannot verify a hard character limit, use:

```ts
characterLimit: { kind: "unknown" }
```

Do not turn a forum post, screenshot, or remembered limit into a registry fact.

## Add the surface

Provider targets live in:

```text
packages/core/src/targets/
  openai.ts
  anthropic.ts
  google.ts
```

Add a new `defineSurface(...)` entry to the matching provider file.

Every entry requires:

- a stable lowercase kebab-case id
- provider and product
- a user-facing surface label
- the instruction role
- a verified character constraint or `unknown`
- an HTTPS official source
- the date you verified the source

## Limits

There are three supported states.

### Fixed

```ts
characterLimit: { kind: "fixed", value: 5000 }
```

Use this only when the same documented limit applies to the surface.

### By plan

```ts
characterLimit: {
  kind: "by-plan",
  values: {
    free: 1500,
    plus: 5000
  }
}
```

Do not fill missing plans by guessing.

### Unknown

```ts
characterLimit: { kind: "unknown" }
```

Unknown is a valid and preferable answer when documentation is incomplete.

## Test the behavior

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

If the new surface changes compiler ordering or formatting, add a regression test for that provider.

## Pull request

In the pull request body, include:

1. the exact target being added
2. the official documentation URL
3. the verified date
4. any limit or capability that remains unknown

A small, source-backed target contribution is intentionally a good first contribution to Humanizer.
