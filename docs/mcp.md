# MCP server

Humanizer exposes the deterministic compiler through a local Model Context Protocol server.

The MCP server does not execute provider requests and does not read desktop API keys. It only exposes source-backed registry metadata and prompt compilation from `@humanizer/core`.

## Protocol and transport

Humanizer uses the current `@modelcontextprotocol/server` v2 package and serves over stdio with `serveStdio(factory)`.

Build it from the repository root:

```bash
pnpm install
pnpm --filter @humanizer/mcp build
```

The bundled binary is:

```text
apps/mcp/dist/index.js
```

When installed or linked as a package, the command is:

```text
humanizer-mcp
```

The process writes MCP JSON-RPC only to stdout. Human-readable startup messages go to stderr.

## Tools

### `humanizer_list_models`

Lists source-backed models known to Humanizer.

Optional input:

```json
{
  "provider": "openai"
}
```

Each entry includes provider, context window, maximum output tokens, and verification source.

### `humanizer_list_targets`

Lists prompt target surfaces known to Humanizer.

Optional input:

```json
{
  "provider": "anthropic"
}
```

Each target includes its instruction role, verified limits, and source metadata.

### `humanizer_compile`

Compiles an independent Humanizer profile with the same deterministic compiler used by Prompt Studio and the CLI.

Example arguments:

```json
{
  "profileDocument": {
    "schemaVersion": 5,
    "id": "example",
    "name": "Example",
    "description": "",
    "profile": {
      "...": "complete exported BehaviorProfile"
    },
    "baseProfileId": null,
    "inheritedFields": [],
    "createdAt": "2026-10-01T00:00:00.000Z",
    "updatedAt": "2026-10-01T00:00:00.000Z"
  },
  "surfaceId": "openai-api-developer",
  "modelId": "gpt-5.6-sol",
  "optimization": "balanced",
  "brief": {
    "purpose": "engineering",
    "task": "Review the implementation.",
    "context": "Existing project context.",
    "output": "Return the diagnosis and patch plan.",
    "constraints": "Do not invent APIs."
  },
  "includeArtifact": true
}
```

The result contains:

- compile status;
- compiled text;
- character count and verified target limit;
- compacted and omitted blocks;
- warnings and deterministic inspector diagnostics;
- selected model and target metadata;
- optional target-aware export artifact.

A verified target overflow or blocking diagnostic is returned as an MCP tool error while preserving the structured compilation result in the text block.

## Profile inheritance

The MCP server intentionally refuses unresolved derived profiles.

A derived profile references other local profile documents. Sending only that one document to an MCP host would lose inherited behavior. Detach/export an independent profile first, or resolve inheritance in the calling system before invoking `humanizer_compile`.

## Host configuration

Any MCP host that can launch a stdio server can start the bundled file with Node.js 22+.

Conceptually:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/humanizer/apps/mcp/dist/index.js"]
}
```

Exact host configuration keys differ by client. Humanizer does not require an HTTP server or cloud account.
