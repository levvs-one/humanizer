# Target registry

The registry is the compatibility layer between Humanizer and AI products.

Every entry represents one instruction surface, not merely a provider or model.

## Required fields

A surface records:

- stable identifier
- provider
- product
- surface name
- supported instruction role
- known character or token constraint
- plan-specific limits when they exist
- official source
- last verification date
- a short note when the limit is model-dependent or unpublished

## Evidence policy

Hard limits require an official source.

A community report can inform testing, but it cannot become a hard limit in the registry.

When an official limit is unavailable, store `null` and display that the hard limit is not verified. Recommended budgets belong in a separate field and must never be presented as platform limits.

## Updates

Registry data will eventually be signed and update independently of the desktop release.

A registry change must include:

1. the old value
2. the new value
3. the official source
4. the verification date
5. a test covering the changed behavior

## Initial verified entry

ChatGPT Custom Instructions currently allows 1,500 characters on Free and Go, and 5,000 characters on Plus, Pro, Enterprise, Business, and Education.

Source: https://help.openai.com/en/articles/8096356-custom-instructions-for-chatgpt

Verified: 2026-09-30


## Freshness diagnostics

Registry verification dates are machine-readable, not decorative metadata.

The core `findStaleTargetSources` utility accepts a reference date and maximum age in days, then reports targets whose official-source verification is older than that threshold. It performs no network requests and never assumes stale metadata is wrong; it only flags entries that should be re-verified.

The exact threshold is considered fresh. For example, a target verified 30 days ago is not reported when the configured maximum age is 30 days.
