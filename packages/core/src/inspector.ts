import type {
  CompileRequest,
  CompileStatus,
  ModelDefinition,
  PromptDiagnostic,
  PromptOptimization,
  PromptSurface
} from "./types"

export interface PromptInspectionContext {
  text: string
  characterCount: number
  characterLimit: number | null
  status: CompileStatus
  compactedBlocks: readonly string[]
  omittedBlocks: readonly string[]
  surface: PromptSurface
  model: ModelDefinition | null
  optimization: PromptOptimization
}

const CANNED_PHRASES = [
  "certainly!",
  "here's a comprehensive",
  "here is a comprehensive",
  "in conclusion",
  "it's important to note",
  "it is important to note",
  "delve into",
  "supercharge your"
] as const

function sourceText(request: CompileRequest): string {
  return [
    request.profile.role,
    request.profile.objective,
    request.brief?.goal ?? "",
    request.brief?.context ?? "",
    request.brief?.output ?? "",
    request.brief?.constraints ?? ""
  ]
    .filter(Boolean)
    .join("\n")
}

function normalizeSentence(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function repeatedSourceSentence(text: string): string | null {
  const sentences = text
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24)

  const seen = new Map<string, number>()

  for (const sentence of sentences) {
    const normalized = normalizeSentence(sentence)

    if (normalized.length < 20) {
      continue
    }

    const count = (seen.get(normalized) ?? 0) + 1
    seen.set(normalized, count)

    if (count >= 2) {
      return sentence
    }
  }

  return null
}

export function inspectPrompt(
  request: CompileRequest,
  context: PromptInspectionContext
): PromptDiagnostic[] {
  const diagnostics: PromptDiagnostic[] = []
  const source = sourceText(request)
  const lowerSource = source.toLowerCase()

  if (context.model && context.model.provider !== context.surface.provider) {
    diagnostics.push({
      code: "model-target-mismatch",
      severity: "error",
      message:
        context.model.label +
        " does not match the selected " +
        context.surface.product +
        " target."
    })
  }

  if (
    context.surface.instructionRole === "user" &&
    !request.brief?.goal.trim()
  ) {
    diagnostics.push({
      code: "missing-task",
      severity: "warning",
      message: "Add a concrete task before using this as a user prompt."
    })
  }

  if (context.status === "overflow" && context.characterLimit !== null) {
    diagnostics.push({
      code: "overflow",
      severity: "error",
      message:
        context.optimization === "maximum-fidelity"
          ? "The prompt exceeds the verified limit. Maximum fidelity will not compact or omit instructions."
          : "The prompt still exceeds the verified limit after safe optimization."
    })
  } else if (
    context.characterLimit !== null &&
    context.characterCount / context.characterLimit >= 0.85
  ) {
    diagnostics.push({
      code: "near-limit",
      severity: "warning",
      message: "The prompt uses at least 85% of the verified character limit."
    })
  }

  if (context.characterLimit === null) {
    diagnostics.push({
      code: "unverified-limit",
      severity: "info",
      message: "This target has no verified hard character limit in the registry."
    })
  }

  if (context.omittedBlocks.length > 0) {
    diagnostics.push({
      code: "omitted-blocks",
      severity: "warning",
      message:
        "Optimization omitted " +
        context.omittedBlocks.join(", ") +
        " to fit the target."
    })
  }

  if (context.compactedBlocks.length > 0) {
    diagnostics.push({
      code: "compacted-blocks",
      severity: "info",
      message:
        "Optimization compacted " +
        context.compactedBlocks.join(", ") +
        "."
    })
  }

  const canned = CANNED_PHRASES.find((phrase) => lowerSource.includes(phrase))
  if (canned) {
    diagnostics.push({
      code: "canned-ai-phrase",
      severity: "warning",
      message:
        'The source instructions contain the templated phrase "' +
        canned +
        '". Consider replacing it with direct intent.'
    })
  }

  if (/\s[·•]\s/.test(source)) {
    diagnostics.push({
      code: "decorative-separator",
      severity: "warning",
      message: "The source instructions use decorative inline separators. Prefer structure or plain sentences."
    })
  }

  const repeated = repeatedSourceSentence(source)
  if (repeated) {
    diagnostics.push({
      code: "repeated-instruction",
      severity: "warning",
      message: "The source instructions repeat the same sentence. Remove the duplicate before compiling."
    })
  }

  return diagnostics
}
