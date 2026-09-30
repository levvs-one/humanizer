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
    "role",
    "objective",
    "accuracy",
    "research",
    "workflow",
    "communication",
    "writing"
  ] as const

  const instructionOrder = [
    "role",
    "objective",
    "task",
    "context",
    "output",
    "constraints",
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

function renderBlock(block: PromptIRBlock, variant: "full" | "compact"): string {
  return block.heading + "\n" + (variant === "compact" ? block.compact : block.full)
}

function render(
  blocks: PromptIRBlock[],
  variants: Map<string, "full" | "compact">,
  omitted: Set<string>
): string {
  return blocks
    .filter((block) => !omitted.has(block.id))
    .map((block) => renderBlock(block, variants.get(block.id) ?? "full"))
    .join("\n\n")
    .trim()
}

export function compilePrompt(request: CompileRequest): CompileResult {
  const surface = getSurface(request.target.surfaceId)
  const model = request.target.modelId ? getModel(request.target.modelId) : null
  const limit = resolveCharacterLimit(surface, request.target.plan)
  const ir = buildPromptIR(request.profile, request.brief)
  const blocks = orderBlocks(ir.blocks, surface)
  const variants = new Map<string, "full" | "compact">(
    blocks.map((block) => [block.id, "full"])
  )
  const omitted = new Set<string>()
  const compactedBlocks: string[] = []
  const omittedBlocks: string[] = []

  let text = render(blocks, variants, omitted)

  if (limit !== null && text.length > limit) {
    const byAscendingPriority = [...blocks].sort((a, b) => a.priority - b.priority)

    for (const block of byAscendingPriority) {
      if (text.length <= limit) {
        break
      }

      if (block.compact.length >= block.full.length) {
        continue
      }

      variants.set(block.id, "compact")
      compactedBlocks.push(block.id)
      text = render(blocks, variants, omitted)
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
      text = render(blocks, variants, omitted)
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

  if (status === "overflow") {
    warnings.push(
      "Critical intent does not fit the verified limit. Humanizer did not truncate it."
    )
  }

  return {
    text,
    characterCount: text.length,
    characterLimit: limit,
    status,
    compactedBlocks,
    omittedBlocks,
    warnings,
    surface,
    model
  }
}
