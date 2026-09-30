import type {
  CompileResult,
  PromptSurface,
  ProviderId
} from "./types"

export type TargetExportFormat = "text" | "json"

export interface TargetExportArtifact {
  format: TargetExportFormat
  extension: "txt" | "json"
  mediaType: "text/plain;charset=utf-8" | "application/json;charset=utf-8"
  label: string
  content: string
}

function jsonArtifact(label: string, payload: unknown): TargetExportArtifact {
  return {
    format: "json",
    extension: "json",
    mediaType: "application/json;charset=utf-8",
    label,
    content: JSON.stringify(payload, null, 2) + "\n"
  }
}

function textArtifact(text: string): TargetExportArtifact {
  return {
    format: "text",
    extension: "txt",
    mediaType: "text/plain;charset=utf-8",
    label: "Plain text",
    content: text.endsWith("\n") ? text : text + "\n"
  }
}

function isApiSurface(surface: PromptSurface): boolean {
  return surface.product.endsWith("API")
}

function openAIExport(
  text: string,
  role: PromptSurface["instructionRole"]
): TargetExportArtifact {
  if (role === "user") {
    return jsonArtifact("OpenAI Responses input", {
      input: text
    })
  }

  return jsonArtifact("OpenAI Responses instructions", {
    instructions: text
  })
}

function anthropicExport(
  text: string,
  role: PromptSurface["instructionRole"]
): TargetExportArtifact {
  if (role === "user") {
    return jsonArtifact("Anthropic Messages input", {
      messages: [
        {
          role: "user",
          content: text
        }
      ]
    })
  }

  return jsonArtifact("Anthropic Messages system", {
    system: text
  })
}

function googleExport(
  text: string,
  role: PromptSurface["instructionRole"]
): TargetExportArtifact {
  if (role === "user") {
    return jsonArtifact("Gemini generateContent input", {
      contents: [
        {
          role: "user",
          parts: [{ text }]
        }
      ]
    })
  }

  return jsonArtifact("Gemini generateContent system instruction", {
    system_instruction: {
      parts: [{ text }]
    }
  })
}

const API_EXPORTERS: Record<
  ProviderId,
  (text: string, role: PromptSurface["instructionRole"]) => TargetExportArtifact
> = {
  openai: openAIExport,
  anthropic: anthropicExport,
  google: googleExport
}

export function buildTargetExport(
  result: Pick<CompileResult, "text" | "surface">
): TargetExportArtifact {
  if (!isApiSurface(result.surface)) {
    return textArtifact(result.text)
  }

  return API_EXPORTERS[result.surface.provider](
    result.text,
    result.surface.instructionRole
  )
}
