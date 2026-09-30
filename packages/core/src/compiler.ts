import { inspectPrompt } from "./inspector"
import { getModel } from "./models"
import { buildPromptIR, type PromptIRBlock } from "./prompt-ir"
import { getSurface, resolveCharacterLimit } from "./registry"
import type { CompileRequest, CompileResult, PromptSurface } from "./types"

function indexFor(order: readonly string[], id: string): number {
  const index = order.indexOf(id)
  return index === -1 ? order.length : index
}

function orderBlocks(blocks: PromptIRBlock[], surface: PromptSurface): PromptIRBlock[] {
  const userOrder = [
    "task",
    "context",
    "output",
    "constraints",
    "rules",
    "role",
    "objective",
    "strategy",
    "accuracy",
    "research",
    "workflow",
    "communication",
    "writing"
  ] as const

  const instructionOrder = [
    "role",
    "objective",
    "strategy",
    "task",
    "context",
    "output",
    "constraints",
    "rules",
    "accuracy",
    "research",
    "workflow",
    "communication",
    "writing"
  ] as const

  const order = surface.instructionRole === "user" ? userOrder : instructionOrder

  return [...blocks].sort(
    (a, b) => indexFor(order, a.id) - indexFor(order, b.id)
  )
}

function renderBlock(
  block: PromptIRBlock,
  variant: "full" | "compact",
  surface: PromptSurface
): string {
  const content = variant === "compact" ? block.compact : block.full

  if (surface.provider === "anthropic") {
    return "<" + block.id + ">\n" + content + "\n</" + block.id + ">"
  }

  return block.heading + "\n" + content
}

function render(
  blocks: PromptIRBlock[],
  variants: Map<string, "full" | "compact">,
  omitted: Set<string>,
  surface: PromptSurface
): string {
  return blocks
    .filter((block) => !omitted.has(block.id))
    .map((block) => renderBlock(block, variants.get(block.id) ?? "full", surface))
    .join("\n\n")
    .trim()
}

export function compilePrompt(request: CompileRequest): CompileResult {
  const surface = getSurface(request.target.surfaceId)
  const model = request.target.modelId ? getModel(request.target.modelId) : null
  const limit = resolveCharacterLimit(surface, request.target.plan)
  const ir = buildPromptIR(request.profile, request.brief)
  const blocks = orderBlocks(ir.blocks, surface)
  const optimization = request.target.optimization ?? "balanced"
  const variants = new Map<string, "full" | "compact">(
    blocks.map((block) => [
      block.id,
      optimization === "compact" ? "compact" : "full"
    ])
  )
  const omitted = new Set<string>()
  const compactedBlocks: string[] =
    optimization === "compact"
      ? blocks
          .filter((block) => block.compact.length < block.full.length)
          .map((block) => block.id)
      : []
  const omittedBlocks: string[] = []

  let text = render(blocks, variants, omitted, surface)

  if (
    limit !== null &&
    text.length > limit &&
    optimization !== "maximum-fidelity"
  ) {
    const byAscendingPriority = [...blocks].sort((a, b) => a.priority - b.priority)

    if (optimization === "balanced") {
      for (const block of byAscendingPriority) {
        if (text.length <= limit) {
          break
        }

        if (block.compact.length >= block.full.length) {
          continue
        }

        variants.set(block.id, "compact")
        compactedBlocks.push(block.id)
        text = render(blocks, variants, omitted, surface)
      }
    }

    for (const block of byAscendingPriority) {
      if (text.length <= limit) {
        break
      }

      if (block.required) {
        continue
      }

      omitted.add(block.id)
      omittedBlocks.push(block.id)
      text = render(blocks, variants, omitted, surface)
    }
  }

  const warnings: string[] = []

  if (model && model.provider !== surface.provider) {
    warnings.push(
      model.label + " does not match the selected " + surface.product + " target."
    )
  }

  if (surface.characterLimit.kind === "by-plan" && request.target.plan === undefined) {
    warnings.push("Choose a plan to resolve this surface's character limit.")
  } else if (limit === null) {
    warnings.push(
      surface.tokenLimitNote ??
        "No verified hard character limit is stored for this surface."
    )
  }

  const status =
    limit === null ? "no-verified-limit" : text.length <= limit ? "fits" : "overflow"

  if (
    surface.instructionRole === "user" &&
    !request.brief?.goal.trim()
  ) {
    warnings.push("Add a task. This user prompt currently contains behavior without a concrete job.")
  }

  if (status === "overflow") {
    warnings.push(
      optimization === "maximum-fidelity"
        ? "Maximum fidelity keeps every instruction intact. Switch to Balanced or Compact to optimize for this target."
        : "Critical intent does not fit the verified limit. Humanizer did not truncate it."
    )
  }

  const diagnostics = inspectPrompt(request, {
    text,
    characterCount: text.length,
    characterLimit: limit,
    status,
    compactedBlocks,
    omittedBlocks,
    surface,
    model,
    optimization
  })

  return {
    text,
    characterCount: text.length,
    characterLimit: limit,
    status,
    compactedBlocks,
    omittedBlocks,
    warnings,
    surface,
    model,
    optimization,
    diagnostics
  }
}
