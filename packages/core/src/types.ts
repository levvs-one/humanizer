export type ProviderId = "openai" | "anthropic" | "google"

export type PlanId =
  | "free"
  | "go"
  | "plus"
  | "pro"
  | "business"
  | "enterprise"
  | "education"

export type PromptPurpose =
  | "general"
  | "engineering"
  | "research"
  | "writing"
  | "agent"

export type Verbosity = "low" | "medium" | "high"

export type CharacterLimit =
  | { kind: "fixed"; value: number }
  | { kind: "by-plan"; values: Partial<Record<PlanId, number>> }
  | { kind: "unknown" }

export interface PromptSurface {
  id: string
  provider: ProviderId
  product: string
  label: string
  instructionRole: "persistent" | "developer" | "system"
  characterLimit: CharacterLimit
  tokenLimitNote?: string
  source: {
    label: string
    url: string
    verifiedAt: string
  }
}

export interface BehaviorProfile {
  role: string
  objective: string
  purpose: PromptPurpose
  communication: {
    naturalness: number
    directness: number
    verbosity: Verbosity
  }
  research: {
    rigor: number
    preferPrimarySources: boolean
    allowCommunitySources: boolean
  }
  writing: {
    avoidAISlop: boolean
    avoidUnnecessaryHeadings: boolean
    avoidRestatingPrompt: boolean
  }
}

export interface PromptTarget {
  surfaceId: string
  plan?: PlanId
}

export interface CompileRequest {
  profile: BehaviorProfile
  target: PromptTarget
}

export type CompileStatus = "fits" | "overflow" | "no-verified-limit"

export interface CompileResult {
  text: string
  characterCount: number
  characterLimit: number | null
  status: CompileStatus
  compactedBlocks: string[]
  omittedBlocks: string[]
  warnings: string[]
  surface: PromptSurface
}
