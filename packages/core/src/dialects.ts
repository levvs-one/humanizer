import type { PromptIRBlock } from "./prompt-ir"
import type { PromptSurface, ProviderId } from "./types"

type Variant = "full" | "compact"

const OPENAI_USER_ORDER = [
  "task",
  "context",
  "constraints",
  "output",
  "role",
  "objective",
  "strategy",
  "accuracy",
  "research",
  "workflow",
  "communication",
  "writing"
] as const

const OPENAI_INSTRUCTION_ORDER = [
  "role",
  "objective",
  "strategy",
  "accuracy",
  "research",
  "workflow",
  "communication",
  "writing",
  "constraints",
  "output",
  "task",
  "context"
] as const

const ANTHROPIC_USER_ORDER = [
  "task",
  "context",
  "output",
  "constraints",
  "role",
  "objective",
  "strategy",
  "accuracy",
  "research",
  "workflow",
  "communication",
  "writing"
] as const

const ANTHROPIC_INSTRUCTION_ORDER = [
  "role",
  "objective",
  "strategy",
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

const GOOGLE_USER_ORDER = [
  "role",
  "objective",
  "strategy",
  "accuracy",
  "research",
  "workflow",
  "communication",
  "writing",
  "constraints",
  "context",
  "task",
  "output"
] as const

const GOOGLE_INSTRUCTION_ORDER = [
  "role",
  "constraints",
  "objective",
  "strategy",
  "accuracy",
  "research",
  "workflow",
  "communication",
  "writing",
  "task",
  "context",
  "output"
] as const

function indexFor(order: readonly string[], id: string): number {
  const index = order.indexOf(id)
  return index === -1 ? order.length : index
}

function orderFor(surface: PromptSurface): readonly string[] {
  const isUser = surface.instructionRole === "user"

  if (surface.provider === "openai") {
    return isUser ? OPENAI_USER_ORDER : OPENAI_INSTRUCTION_ORDER
  }

  if (surface.provider === "anthropic") {
    return isUser ? ANTHROPIC_USER_ORDER : ANTHROPIC_INSTRUCTION_ORDER
  }

  return isUser ? GOOGLE_USER_ORDER : GOOGLE_INSTRUCTION_ORDER
}

export function orderPromptBlocks(
  blocks: readonly PromptIRBlock[],
  surface: PromptSurface
): PromptIRBlock[] {
  const order = orderFor(surface)

  return [...blocks].sort(
    (a, b) => indexFor(order, a.id) - indexFor(order, b.id)
  )
}

function blockContent(block: PromptIRBlock, variant: Variant): string {
  return variant === "compact" ? block.compact : block.full
}

function xmlBlock(block: PromptIRBlock, variant: Variant): string {
  const content = blockContent(block, variant)
  return "<" + block.id + ">\n" + content + "\n</" + block.id + ">"
}

function markdownBlock(block: PromptIRBlock, variant: Variant): string {
  return "# " + block.heading + "\n" + blockContent(block, variant)
}

const RENDERERS: Record<
  ProviderId,
  (block: PromptIRBlock, variant: Variant) => string
> = {
  openai: markdownBlock,
  anthropic: xmlBlock,
  google: xmlBlock
}

export function renderPromptBlock(
  block: PromptIRBlock,
  variant: Variant,
  surface: PromptSurface
): string {
  return RENDERERS[surface.provider](block, variant)
}

export function providerDialectName(surface: PromptSurface): string {
  if (surface.provider === "openai") return "OpenAI Markdown"
  if (surface.provider === "anthropic") return "Anthropic XML"
  return "Gemini XML"
}
