# Contributing

Humanizer is intentionally opinionated. Contributions should make the behavior model, compiler, compatibility registry, evaluation, or interface measurably clearer.

## Before changing code

Open an issue for large product or architecture changes. Small fixes can go directly to a pull request.

For target-registry changes, include the official source and the date you verified it. Do not promote community reports into hard platform limits.

## Local checks

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

For native desktop work:

```bash
pnpm desktop
```

## Interface work

Read `docs/design.md` first.

A new component is not automatically an improvement. Prefer hierarchy, spacing, native controls, and direct copy over ornamental UI. If a control does not help the user make a decision or complete an action, remove it.

## Compiler work

Preserve user intent before wording.

Changes to prompt compilation should include a regression test. A hard target limit must never be satisfied by silently slicing critical instructions.

## Pull requests

Keep pull requests narrow enough to review. Explain what behavior changed and why. Screenshots are useful for visible interface changes, but they do not replace testing responsive states.
