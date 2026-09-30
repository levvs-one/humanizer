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
export type UncertaintyHandling = "quiet" | "explicit" | "strict"

export type CharacterLimit =
  | { kind: "fixed"; value: number }
  | { kind: "by-plan"; values: Partial<Record<PlanId, number>> }
  | { kind: "unknown" }

export interface SourceReference {
  label: string
  url: string
  verifiedAt: string
}

export interface PromptSurface {
  id: string
  provider: ProviderId
  product: string
  label: string
  instructionRole: "persistent" | "developer" | "system" | "user"
  characterLimit: CharacterLimit
  tokenLimitNote?: string
  source: SourceReference
}

export interface ModelDefinition {
  id: string
  provider: ProviderId
  label: string
  contextWindowTokens: number | null
  maxOutputTokens: number | null
  source: SourceReference
}

export interface BehaviorProfile {
  role: string
  objective: string
  purpose: PromptPurpose
  communication: {
    naturalness: number
    directness: number
    formality: number
    humor: number
    verbosity: Verbosity
  }
  reasoning: {
    initiative: number
    verification: number
    uncertaintyHandling: UncertaintyHandling
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

export interface PromptBrief {
  purpose?: PromptPurpose
  goal: string
  context: string
  output: string
  constraints: string
}

export type PromptOptimization = "compact" | "balanced" | "maximum-fidelity"

export interface PromptTarget {
  surfaceId: string
  plan?: PlanId
  modelId?: string
  optimization?: PromptOptimization
}

export interface CompileRequest {
  profile: BehaviorProfile
  target: PromptTarget
  brief?: PromptBrief
}

export type CompileStatus = "fits" | "overflow" | "no-verified-limit"

export type PromptDiagnosticSeverity = "info" | "warning" | "error"

export interface PromptDiagnostic {
  code: string
  severity: PromptDiagnosticSeverity
  message: string
}

export interface CompileResult {
  text: string
  characterCount: number
  characterLimit: number | null
  status: CompileStatus
  compactedBlocks: string[]
  omittedBlocks: string[]
  warnings: string[]
  surface: PromptSurface
  model: ModelDefinition | null
  optimization: PromptOptimization
  diagnostics: PromptDiagnostic[]
}
