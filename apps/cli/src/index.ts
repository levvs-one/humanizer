import { readFile, writeFile } from "node:fs/promises"
import {
  buildTargetExport,
  compilePrompt,
  MODELS,
  parseProfileDocument,
  parseProjectDocument,
  parsePromptDraftDocument,
  resolveBehaviorScopes,
  SURFACES,
  type PlanId,
  type PromptBrief,
  type PromptOptimization,
  type PromptPurpose
} from "@humanizer/core"

const VALUE_OPTIONS = new Set([
  "profile",
  "project",
  "draft",
  "surface",
  "model",
  "plan",
  "optimization",
  "task",
  "context",
  "output",
  "constraints",
  "purpose",
  "out"
])

const FLAG_OPTIONS = new Set(["artifact", "json", "quiet", "help"])

const PLANS: readonly PlanId[] = [
  "free",
  "go",
  "plus",
  "pro",
  "business",
  "enterprise",
  "education"
]

const OPTIMIZATIONS: readonly PromptOptimization[] = [
  "compact",
  "balanced",
  "maximum-fidelity"
]

const PURPOSES: readonly PromptPurpose[] = [
  "general",
  "engineering",
  "research",
  "writing",
  "agent"
]

type Options = Record<string, string | boolean>

function helpText(): string {
  return `Humanizer CLI

Usage:
  humanizer models [--json]
  humanizer targets [--json]
  humanizer compile --profile <file> [--project <file>] [--draft <file>] [options]

Compile inputs:
  --profile <file>          Independent exported behavior profile
  --project <file>          Optional exported project scope
  --draft <file>            Optional exported Prompt Studio draft

Target options:
  --surface <id>            Required unless the draft supplies a target surface
  --model <id>              Overrides the draft model when supplied
  --plan <id>               free|go|plus|pro|business|enterprise|education
  --optimization <mode>     compact|balanced|maximum-fidelity

Task options:
  --task <text>             Concrete task; overrides the draft goal
  --context <text>          Task context; overrides the draft context
  --output <text>           Expected output; overrides the draft output
  --constraints <text>      Hard constraints; overrides draft constraints
  --purpose <purpose>       general|engineering|research|writing|agent

Output options:
  --artifact                Emit target-aware text/JSON artifact instead of prompt text
  --out <file>              Write output to a file instead of stdout
  --quiet                   Suppress warnings and diagnostics on stderr

Examples:
  humanizer compile --profile ./engineer.humanizer.json \
    --surface openai-api-developer --model gpt-5.6-sol \
    --task "Review this implementation" --optimization balanced

  humanizer compile --profile ./engineer.humanizer.json \
    --project ./payments.humanizer-project.json \
    --draft ./retry-review.humanizer-prompt.json

  humanizer compile --profile ./engineer.humanizer.json \
    --project ./payments.humanizer-project.json \
    --draft ./retry-review.humanizer-prompt.json \
    --model claude-sonnet-5 --surface anthropic-api-system

Exit codes:
  0  Compiled successfully
  1  Invalid CLI input, incompatible documents, or unreadable file
  2  Compilation completed with a blocking diagnostic or target overflow
`
}

function parseOptions(args: string[]): Options {
  const options: Options = {}

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]

    if (!token?.startsWith("--")) {
      throw new Error("Unexpected argument: " + String(token))
    }

    const name = token.slice(2)

    if (FLAG_OPTIONS.has(name)) {
      options[name] = true
      continue
    }

    if (!VALUE_OPTIONS.has(name)) {
      throw new Error("Unknown option: --" + name)
    }

    const value = args[index + 1]
    if (!value || value.startsWith("--")) {
      throw new Error("Option --" + name + " requires a value.")
    }

    options[name] = value
    index += 1
  }

  return options
}

function stringOption(
  options: Options,
  name: string,
  required = false
): string | undefined {
  const value = options[name]

  if (typeof value === "string") {
    return value
  }

  if (required) {
    throw new Error("Missing required option --" + name + ".")
  }

  return undefined
}

function enumOption<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  name: string
): T | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!allowed.includes(value as T)) {
    throw new Error(
      "Invalid --" + name + " value. Expected one of: " + allowed.join(", ")
    )
  }

  return value as T
}

function writeLine(value: string): void {
  process.stdout.write(value.endsWith("\n") ? value : value + "\n")
}

function listModels(json: boolean): void {
  if (json) {
    writeLine(JSON.stringify(MODELS, null, 2))
    return
  }

  for (const model of MODELS) {
    writeLine(
      [
        model.id,
        model.provider,
        model.contextWindowTokens ?? "unknown-context",
        model.maxOutputTokens ?? "unknown-output"
      ].join("\t")
    )
  }
}

function listTargets(json: boolean): void {
  if (json) {
    writeLine(JSON.stringify(SURFACES, null, 2))
    return
  }

  for (const surface of SURFACES) {
    writeLine(
      [
        surface.id,
        surface.provider,
        surface.product,
        surface.label,
        surface.instructionRole
      ].join("\t")
    )
  }
}

function validateDocumentLinks(
  profileId: string,
  projectId: string | undefined,
  draft:
    | {
        profileId: string
        projectId: string | null
      }
    | undefined
): void {
  if (!draft) {
    return
  }

  if (draft.profileId !== profileId) {
    throw new Error(
      "Draft profileId " +
        JSON.stringify(draft.profileId) +
        " does not match profile id " +
        JSON.stringify(profileId) +
        "."
    )
  }

  if (draft.projectId === null && projectId !== undefined) {
    throw new Error(
      "The draft does not reference a project, but --project was supplied."
    )
  }

  if (draft.projectId !== null && projectId === undefined) {
    throw new Error(
      "The draft references project " +
        JSON.stringify(draft.projectId) +
        ". Supply the matching --project file."
    )
  }

  if (draft.projectId !== null && projectId !== draft.projectId) {
    throw new Error(
      "Draft projectId " +
        JSON.stringify(draft.projectId) +
        " does not match project id " +
        JSON.stringify(projectId) +
        "."
    )
  }
}

function resolveBrief(
  options: Options,
  draftBrief: PromptBrief | undefined
): PromptBrief | undefined {
  const task = stringOption(options, "task")
  const context = stringOption(options, "context")
  const output = stringOption(options, "output")
  const constraints = stringOption(options, "constraints")
  const purpose = enumOption(
    stringOption(options, "purpose"),
    PURPOSES,
    "purpose"
  )

  const hasCliBrief =
    task !== undefined ||
    context !== undefined ||
    output !== undefined ||
    constraints !== undefined ||
    purpose !== undefined

  if (!draftBrief && !hasCliBrief) {
    return undefined
  }

  return {
    goal: task ?? draftBrief?.goal ?? "",
    context: context ?? draftBrief?.context ?? "",
    output: output ?? draftBrief?.output ?? "",
    constraints: constraints ?? draftBrief?.constraints ?? "",
    ...(purpose !== undefined
      ? { purpose }
      : draftBrief?.purpose !== undefined
        ? { purpose: draftBrief.purpose }
        : {})
  }
}

async function compile(options: Options): Promise<void> {
  const profilePath = stringOption(options, "profile", true)!
  const projectPath = stringOption(options, "project")
  const draftPath = stringOption(options, "draft")

  const profileDocument = parseProfileDocument(
    await readFile(profilePath, "utf8")
  )
  if (
    profileDocument.baseProfileId !== null ||
    profileDocument.inheritedFields.length > 0
  ) {
    throw new Error(
      "This profile still depends on a base profile. Export an independent/detached profile before compiling it with the CLI."
    )
  }

  const projectDocument = projectPath
    ? parseProjectDocument(await readFile(projectPath, "utf8"))
    : undefined
  const draftDocument = draftPath
    ? parsePromptDraftDocument(await readFile(draftPath, "utf8"))
    : undefined

  validateDocumentLinks(
    profileDocument.id,
    projectDocument?.id,
    draftDocument
  )

  const surfaceId =
    stringOption(options, "surface") ?? draftDocument?.target.surfaceId
  if (!surfaceId) {
    throw new Error(
      "Missing required option --surface. Supply a target surface or a draft that contains one."
    )
  }

  const modelId =
    stringOption(options, "model") ?? draftDocument?.target.modelId
  const plan =
    enumOption(stringOption(options, "plan"), PLANS, "plan") ??
    draftDocument?.target.plan
  const optimization =
    enumOption(
      stringOption(options, "optimization"),
      OPTIMIZATIONS,
      "optimization"
    ) ?? draftDocument?.target.optimization

  if (!SURFACES.some((surface) => surface.id === surfaceId)) {
    throw new Error(
      "Unknown surface: " + surfaceId + ". Run 'humanizer targets' to list ids."
    )
  }

  if (modelId && !MODELS.some((model) => model.id === modelId)) {
    throw new Error(
      "Unknown model: " + modelId + ". Run 'humanizer models' to list ids."
    )
  }

  const { effectiveProfile } = resolveBehaviorScopes({
    profile: profileDocument.profile,
    ...(projectDocument ? { project: projectDocument } : {}),
    ...(modelId ? { modelId } : {}),
    ...(draftDocument
      ? { taskOverrides: draftDocument.behaviorOverrides }
      : {})
  })

  const brief = resolveBrief(options, draftDocument?.brief)
  const result = compilePrompt({
    profile: effectiveProfile,
    ...(brief ? { brief } : {}),
    target: {
      surfaceId,
      ...(modelId ? { modelId } : {}),
      ...(plan ? { plan } : {}),
      ...(optimization ? { optimization } : {})
    }
  })

  if (options.quiet !== true) {
    for (const warning of result.warnings) {
      process.stderr.write("warning: " + warning + "\n")
    }

    for (const diagnostic of result.diagnostics) {
      process.stderr.write(
        diagnostic.severity + ": " + diagnostic.message + "\n"
      )
    }
  }

  const emitted =
    options.artifact === true
      ? buildTargetExport(result).content
      : result.text + (result.text.endsWith("\n") ? "" : "\n")
  const outputPath = stringOption(options, "out")

  if (outputPath) {
    await writeFile(outputPath, emitted, "utf8")
  } else {
    process.stdout.write(emitted)
  }

  if (
    result.status === "overflow" ||
    result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
  ) {
    process.exitCode = 2
  }
}

async function main(): Promise<void> {
  const [command = "help", ...args] = process.argv.slice(2)
  const options = parseOptions(args)

  if (command === "help" || options.help === true) {
    writeLine(helpText())
    return
  }

  if (command === "models") {
    listModels(options.json === true)
    return
  }

  if (command === "targets") {
    listTargets(options.json === true)
    return
  }

  if (command === "compile") {
    await compile(options)
    return
  }

  throw new Error("Unknown command: " + command + ". Run 'humanizer help'.")
}

main().catch((reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  process.stderr.write("humanizer: " + message + "\n")
  process.exitCode = 1
})
