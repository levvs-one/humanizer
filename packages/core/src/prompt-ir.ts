import type { BehaviorProfile, PromptBrief } from "./types"

export const PROMPT_IR_VERSION = 2 as const

export type PromptIRBlockId =
  | "role"
  | "objective"
  | "task"
  | "context"
  | "output"
  | "constraints"
  | "accuracy"
  | "research"
  | "communication"
  | "writing"
  | "workflow"

export interface PromptIRBlock {
  id: PromptIRBlockId
  heading: string
  priority: number
  required: boolean
  full: string
  compact: string
}

export interface PromptIR {
  version: typeof PROMPT_IR_VERSION
  purpose: BehaviorProfile["purpose"]
  blocks: PromptIRBlock[]
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

function writingInstruction(profile: BehaviorProfile): string {
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

function briefBlocks(brief?: PromptBrief): PromptIRBlock[] {
  if (!brief) {
    return []
  }

  const blocks: PromptIRBlock[] = []
  const goal = brief.goal.trim()
  const context = brief.context.trim()
  const output = brief.output.trim()
  const constraints = brief.constraints.trim()

  if (goal) {
    blocks.push({
      id: "task",
      heading: "Task",
      priority: 100,
      required: true,
      full: goal,
      compact: goal
    })
  }

  if (context) {
    blocks.push({
      id: "context",
      heading: "Context",
      priority: 94,
      required: false,
      full: context,
      compact: context
    })
  }

  if (output) {
    blocks.push({
      id: "output",
      heading: "Output",
      priority: 96,
      required: true,
      full: output,
      compact: output
    })
  }

  if (constraints) {
    blocks.push({
      id: "constraints",
      heading: "Constraints",
      priority: 98,
      required: true,
      full: constraints,
      compact: constraints
    })
  }

  return blocks
}

export function buildPromptIR(profile: BehaviorProfile, brief?: PromptBrief): PromptIR {
  const role = profile.role.trim() || "Experienced professional"
  const objective =
    profile.objective.trim() || "Help the user complete the task accurately and efficiently."

  return {
    version: PROMPT_IR_VERSION,
    purpose: profile.purpose,
    blocks: [
      {
        id: "role",
        heading: "Role",
        priority: 100,
        required: true,
        full:
          "Work as " +
          role +
          ". Apply the role's professional standards, judgment, and domain knowledge without claiming a real employer, identity, or personal history.",
        compact:
          role +
          ". Apply the role's professional standards without claiming a real identity or employer."
      },
      {
        id: "objective",
        heading: "Objective",
        priority: 100,
        required: true,
        full: objective,
        compact: objective
      },
      ...briefBlocks(brief),
      {
        id: "accuracy",
        heading: "Accuracy",
        priority: 95,
        required: true,
        full:
          "Separate verified facts from inference. If a fact is current or uncertain and it matters to the answer, verify it before relying on it. Never invent APIs, citations, capabilities, source content, or completed actions.",
        compact:
          "Separate fact from inference. Verify important current or uncertain claims. Never invent APIs, sources, capabilities, or completed actions."
      },
      {
        id: "research",
        heading: "Research",
        priority: 88,
        required: false,
        full: researchInstruction(profile),
        compact:
          "Verify important uncertain facts. Prefer primary sources when enabled and distinguish community experience from verified fact."
      },
      {
        id: "communication",
        heading: "Communication",
        priority: 78,
        required: false,
        full:
          naturalnessInstruction(profile.communication.naturalness) +
          " " +
          directnessInstruction(profile.communication.directness) +
          " " +
          verbosityInstruction(profile),
        compact: "Be natural, direct, and concise. Add detail only when it improves the answer."
      },
      {
        id: "writing",
        heading: "Writing",
        priority: 72,
        required: false,
        full: writingInstruction(profile),
        compact:
          "Avoid canned AI phrasing, needless structure, repeated conclusions, and fake human errors."
      },
      {
        id: "workflow",
        heading: "Working method",
        priority: 64,
        required: false,
        full:
          "Understand the task before acting. Use tools or research when they materially reduce uncertainty. Stop researching when the evidence is sufficient, make the decision, and present the result cleanly.",
        compact: "Use research or tools when they reduce meaningful uncertainty, then act."
      }
    ]
  }
}
