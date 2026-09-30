import { getSurface, resolveCharacterLimit } from "./registry"
import type {
  BehaviorProfile,
  CompileRequest,
  CompileResult,
  PromptSurface
} from "./types"

interface PromptBlock {
  id: string
  priority: number
  required: boolean
  full: string
  compact: string
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function naturalnessInstruction(value: number): string {
  const level = clamp(value)
  if (level >= 75) {
    return "Use natural sentence rhythm and ordinary transitions. Prefer direct prose over templated assistant language."
  }
  if (level >= 40) {
    return "Write clearly and naturally without forcing a conversational voice."
  }
  return "Favor precision and consistency over conversational phrasing."
}

function directnessInstruction(value: number): string {
  const level = clamp(value)
  if (level >= 75) {
    return "Lead with the answer or action. Do not restate the request before responding."
  }
  if (level >= 40) {
    return "Be direct, adding context only when it improves the decision."
  }
  return "Provide context before the conclusion when it materially helps understanding."
}

function verbosityInstruction(profile: BehaviorProfile): string {
  if (profile.communication.verbosity === "low") {
    return "Keep responses compact. Expand only when complexity requires it."
  }
  if (profile.communication.verbosity === "high") {
    return "Be thorough when useful, but do not repeat a conclusion in different words."
  }
  return "Use enough detail to make the answer complete without padding."
}

function researchInstruction(profile: BehaviorProfile): string {
  const rigor = clamp(profile.research.rigor)

  if (rigor < 35) {
    return "Research only when the answer depends on current or uncertain facts."
  }

  const sourceOrder = profile.research.preferPrimarySources
    ? "Prefer official documentation and primary sources."
    : "Choose sources for relevance and reliability."

  const community = profile.research.allowCommunitySources
    ? "Use reputable community discussions for implementation experience, clearly separating them from verified facts."
    : "Do not rely on community discussions when authoritative sources are available."

  if (rigor >= 75) {
    return (
      "When facts are current, consequential, or uncertain, verify them before relying on them. " +
      sourceOrder +
      " Cross-check important claims when practical. " +
      community
    )
  }

  return "Verify uncertain or current claims when needed. " + sourceOrder + " " + community
}

function styleInstruction(profile: BehaviorProfile): string {
  const rules: string[] = []

  if (profile.writing.avoidAISlop) {
    rules.push(
      "Avoid canned openings, repeated conclusions, mechanical symmetry, decorative punctuation, and generic filler."
    )
  }
  if (profile.writing.avoidUnnecessaryHeadings) {
    rules.push("Use headings only when they make a long or complex answer easier to scan.")
  }
  if (profile.writing.avoidRestatingPrompt) {
    rules.push("Do not paraphrase the user's request back to them unless clarification is needed.")
  }

  rules.push("Do not add typos, fake hesitation, or fabricated personal experience to imitate a person.")
  return rules.join(" ")
}

function buildBlocks(profile: BehaviorProfile): PromptBlock[] {
  const role = profile.role.trim() || "Experienced professional"
  const objective = profile.objective.trim() || "Help the user complete the task accurately and efficiently."

  return [
    {
      id: "role",
      priority: 100,
      required: true,
      full:
        "Role\nWork as " +
        role +
        ". Apply the role's professional standards, judgment, and domain knowledge without claiming a real employer, identity, or personal history.",
      compact:
        "Role\n" +
        role +
        ". Apply the role's professional standards without claiming a real identity or employer."
    },
    {
      id: "objective",
      priority: 100,
      required: true,
      full: "Objective\n" + objective,
      compact: "Objective\n" + objective
    },
    {
      id: "accuracy",
      priority: 95,
      required: true,
      full:
        "Accuracy\nSeparate verified facts from inference. If a fact is current or uncertain and it matters to the answer, verify it before relying on it. Never invent APIs, citations, capabilities, source content, or completed actions.",
      compact:
        "Accuracy\nSeparate fact from inference. Verify important current or uncertain claims. Never invent APIs, sources, capabilities, or completed actions."
    },
    {
      id: "research",
      priority: 88,
      required: false,
      full: "Research\n" + researchInstruction(profile),
      compact:
        "Research\nVerify important uncertain facts. Prefer primary sources when enabled and distinguish community experience from verified fact."
    },
    {
      id: "communication",
      priority: 78,
      required: false,
      full:
        "Communication\n" +
        naturalnessInstruction(profile.communication.naturalness) +
        " " +
        directnessInstruction(profile.communication.directness) +
        " " +
        verbosityInstruction(profile),
      compact: "Communication\nBe natural, direct, and concise. Add detail only when it improves the answer."
    },
    {
      id: "writing",
      priority: 72,
      required: false,
      full: "Writing\n" + styleInstruction(profile),
      compact:
        "Writing\nAvoid canned AI phrasing, needless structure, repeated conclusions, and fake human errors."
    },
    {
      id: "workflow",
      priority: 64,
      required: false,
      full:
        "Working method\nUnderstand the task before acting. Use tools or research when they materially reduce uncertainty. Stop researching when the evidence is sufficient, make the decision, and present the result cleanly.",
      compact:
        "Working method\nUse research or tools when they reduce meaningful uncertainty, then act."
    }
  ]
}

function orderBlocks(blocks: PromptBlock[], surface: PromptSurface): PromptBlock[] {
  if (surface.provider === "anthropic") {
    const order = ["role", "objective", "accuracy", "research", "workflow", "communication", "writing"]
    return [...blocks].sort(
      (a, b) => order.indexOf(a.id) - order.indexOf(b.id)
    )
  }

  return blocks
}

function render(
  blocks: PromptBlock[],
  variants: Map<string, "full" | "compact">,
  omitted: Set<string>
): string {
  return blocks
    .filter((block) => !omitted.has(block.id))
    .map((block) => (variants.get(block.id) === "compact" ? block.compact : block.full))
    .join("\n\n")
    .trim()
}

export function compilePrompt(request: CompileRequest): CompileResult {
  const surface = getSurface(request.target.surfaceId)
  const limit = resolveCharacterLimit(surface, request.target.plan)
  const blocks = orderBlocks(buildBlocks(request.profile), surface)
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

  if (
    surface.characterLimit.kind === "by-plan" &&
    request.target.plan === undefined
  ) {
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
    surface
  }
}
