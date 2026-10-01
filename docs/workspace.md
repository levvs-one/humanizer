# Workspace bundles

Humanizer workspace bundles are portable, versioned JSON documents for moving the structured desktop configuration between machines or keeping an offline backup.

A workspace contains:

- behavior profiles, including live inheritance metadata;
- project scopes and model-specific project overrides;
- prompt drafts and their task-level overrides;
- the active profile and active draft ids when available;
- an export timestamp.

A workspace deliberately does **not** contain:

- provider API keys or operating-system credential-store data;
- provider responses or local conversation transcripts;
- transient execution state.

This keeps workspace files focused on reproducible configuration rather than secrets or chat history.

## Validation

Workspace import is strict.

Humanizer rejects a workspace before applying it if it contains:

- duplicate profile, project, or draft ids;
- a derived profile whose base profile is missing;
- an invalid profile inheritance graph;
- a draft that references a missing profile;
- a draft that references a missing project;
- an active profile or draft id that does not exist in the bundle;
- an embedded document that fails its own schema parser.

Humanizer does not silently repair a workspace during import. A backup should either reproduce the original structured state or fail with an actionable error.

## Schema

The current workspace schema version is `1`.

The core API exposes:

- `createWorkspaceDocument`
- `serializeWorkspaceDocument`
- `parseWorkspaceDocument`

Desktop import/export can build on this API without duplicating validation logic.
