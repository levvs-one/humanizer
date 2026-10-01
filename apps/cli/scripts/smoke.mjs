import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const binary = fileURLToPath(new URL("../dist/index.js", import.meta.url))
const profile = fileURLToPath(
  new URL("../fixtures/smoke-profile.humanizer.json", import.meta.url)
)
const project = fileURLToPath(
  new URL("../fixtures/smoke-project.humanizer-project.json", import.meta.url)
)
const draft = fileURLToPath(
  new URL("../fixtures/smoke-draft.humanizer-prompt.json", import.meta.url)
)

function run(args) {
  const result = spawnSync(process.execPath, [binary, ...args], {
    encoding: "utf8"
  })

  if (result.status !== 0) {
    throw new Error(
      "CLI smoke command failed: " +
        args.join(" ") +
        "\nstdout:\n" +
        result.stdout +
        "\nstderr:\n" +
        result.stderr
    )
  }

  return result.stdout
}

function runFailure(args, expectedMessage) {
  const result = spawnSync(process.execPath, [binary, ...args], {
    encoding: "utf8"
  })

  if (result.status !== 1 || !result.stderr.includes(expectedMessage)) {
    throw new Error(
      "CLI failure smoke check failed: " +
        args.join(" ") +
        "\nstatus: " +
        String(result.status) +
        "\nstdout:\n" +
        result.stdout +
        "\nstderr:\n" +
        result.stderr
    )
  }
}

if (!run(["help"]).includes("Humanizer CLI")) {
  throw new Error("CLI help smoke check failed.")
}

if (!run(["models"]).includes("gpt-5.6-sol")) {
  throw new Error("CLI model registry smoke check failed.")
}

if (!run(["targets"]).includes("openai-api-developer")) {
  throw new Error("CLI target registry smoke check failed.")
}

const compiled = run([
  "compile",
  "--profile",
  profile,
  "--surface",
  "openai-api-developer",
  "--model",
  "gpt-5.6-sol",
  "--task",
  "Review this implementation.",
  "--quiet"
])

if (
  !compiled.includes("Principal software engineer") ||
  !compiled.includes("Review this implementation.")
) {
  throw new Error("CLI compile smoke check failed.")
}

process.stderr.write("Humanizer CLI smoke checks passed.\n")


const scoped = run([
  "compile",
  "--profile",
  profile,
  "--project",
  project,
  "--draft",
  draft,
  "--quiet"
])

for (const expected of [
  "Payments reliability engineer",
  "Review payment systems without weakening idempotency.",
  "Preserve idempotency semantics.",
  "Review payment retry logic."
]) {
  if (!scoped.includes(expected)) {
    throw new Error(
      "CLI scoped compile smoke check failed; missing: " + expected
    )
  }
}


runFailure(
  [
    "compile",
    "--profile",
    profile,
    "--draft",
    draft,
    "--quiet"
  ],
  "Supply the matching --project file."
)
