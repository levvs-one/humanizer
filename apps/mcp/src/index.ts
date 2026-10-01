import {
  buildTargetExport,
  compilePrompt,
  MODELS,
  parseProfileDocument,
  SURFACES,
  type PlanId,
  type PromptBrief,
  type PromptOptimization,
  type PromptPurpose,
  type ProviderId
} from "@humanizer/core"
import { McpServer } from "@modelcontextprotocol/server"
import { serveStdio } from "@modelcontextprotocol/server/stdio"
import * as z from "zod/v4"

const providerSchema = z.enum(["openai", "anthropic", "google"])
const planSchema = z.enum([
  "free",
  "go",
  "plus",
  "pro",
  "business",
  "enterprise",
  "education"
])
const optimizationSchema = z.enum([
  "compact",
  "balanced",
  "maximum-fidelity"
])
const purposeSchema = z.enum([
  "general",
  "engineering",
  "research",
  "writing",
  "agent"
])

function textResult(value: unknown, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
      }
    ],
    ...(isError ? { isError: true } : {})
  }
}

function toolError(reason: unknown) {
  return textResult(
    {
      error: reason instanceof Error ? reason.message : String(reason)
    },
    true
  )
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "humanizer",
    version: "0.1.0"
  })

  server.registerTool(
    "humanizer_list_models",
    {
      description:
        "List source-backed AI models known to Humanizer, including provider, context window, maximum output tokens, and verification source.",
      inputSchema: z.object({
        provider: providerSchema.optional()
      })
    },
    async ({ provider }) => {
      const models = MODELS.filter(
        (model) => provider === undefined || model.provider === provider
      )

      return textResult({
        models,
        count: models.length
      })
    }
  )

  server.registerTool(
    "humanizer_list_targets",
    {
      description:
        "List prompt target surfaces known to Humanizer, including provider, instruction role, limits, and verification source.",
      inputSchema: z.object({
        provider: providerSchema.optional()
      })
    },
    async ({ provider }) => {
      const targets = SURFACES.filter(
        (surface) => provider === undefined || surface.provider === provider
      )

      return textResult({
        targets,
        count: targets.length
      })
    }
  )

  server.registerTool(
    "humanizer_compile",
    {
      description:
        "Compile an independent Humanizer behavior profile for a model and target surface using the deterministic Humanizer compiler.",
      inputSchema: z.object({
        profileDocument: z
          .record(z.string(), z.unknown())
          .describe(
            "A complete exported Humanizer ProfileDocument JSON object. Derived profiles must be detached before compilation."
          ),
        surfaceId: z
          .string()
          .min(1)
          .describe("Target id from humanizer_list_targets."),
        modelId: z
          .string()
          .min(1)
          .optional()
          .describe("Optional model id from humanizer_list_models."),
        plan: planSchema.optional(),
        optimization: optimizationSchema.optional(),
        brief: z
          .object({
            purpose: purposeSchema.optional(),
            task: z.string().optional(),
            context: z.string().optional(),
            output: z.string().optional(),
            constraints: z.string().optional()
          })
          .optional(),
        includeArtifact: z
          .boolean()
          .optional()
          .describe(
            "When true, include Humanizer's target-aware text or JSON export artifact."
          )
      })
    },
    async ({
      profileDocument,
      surfaceId,
      modelId,
      plan,
      optimization,
      brief,
      includeArtifact
    }) => {
      try {
        if (!SURFACES.some((surface) => surface.id === surfaceId)) {
          throw new Error(
            "Unknown surface: " +
              surfaceId +
              ". Call humanizer_list_targets to list valid ids."
          )
        }

        if (
          modelId !== undefined &&
          !MODELS.some((model) => model.id === modelId)
        ) {
          throw new Error(
            "Unknown model: " +
              modelId +
              ". Call humanizer_list_models to list valid ids."
          )
        }

        const document = parseProfileDocument(JSON.stringify(profileDocument))

        if (
          document.baseProfileId !== null ||
          document.inheritedFields.length > 0
        ) {
          throw new Error(
            "This profile still depends on a base profile. Detach or export an independent profile before compiling it through MCP."
          )
        }

        const task = brief?.task ?? ""
        const context = brief?.context ?? ""
        const output = brief?.output ?? ""
        const constraints = brief?.constraints ?? ""
        const hasBrief =
          brief !== undefined &&
          (task.length > 0 ||
            context.length > 0 ||
            output.length > 0 ||
            constraints.length > 0 ||
            brief.purpose !== undefined)

        const promptBrief: PromptBrief | undefined = hasBrief
          ? {
              goal: task,
              context,
              output,
              constraints,
              ...(brief?.purpose
                ? { purpose: brief.purpose as PromptPurpose }
                : {})
            }
          : undefined

        const result = compilePrompt({
          profile: document.profile,
          ...(promptBrief ? { brief: promptBrief } : {}),
          target: {
            surfaceId,
            ...(modelId ? { modelId } : {}),
            ...(plan ? { plan: plan as PlanId } : {}),
            ...(optimization
              ? { optimization: optimization as PromptOptimization }
              : {})
          }
        })

        const blocking =
          result.status === "overflow" ||
          result.diagnostics.some(
            (diagnostic) => diagnostic.severity === "error"
          )

        return textResult(
          {
            status: result.status,
            text: result.text,
            characterCount: result.characterCount,
            characterLimit: result.characterLimit,
            optimization: result.optimization,
            compactedBlocks: result.compactedBlocks,
            omittedBlocks: result.omittedBlocks,
            warnings: result.warnings,
            diagnostics: result.diagnostics,
            surface: {
              id: result.surface.id,
              provider: result.surface.provider,
              product: result.surface.product,
              label: result.surface.label,
              instructionRole: result.surface.instructionRole
            },
            model: result.model
              ? {
                  id: result.model.id,
                  provider: result.model.provider,
                  label: result.model.label,
                  contextWindowTokens: result.model.contextWindowTokens,
                  maxOutputTokens: result.model.maxOutputTokens
                }
              : null,
            ...(includeArtifact
              ? { artifact: buildTargetExport(result) }
              : {})
          },
          blocking
        )
      } catch (reason) {
        return toolError(reason)
      }
    }
  )

  return server
}

void serveStdio(createServer)

console.error("Humanizer MCP server running on stdio.")
