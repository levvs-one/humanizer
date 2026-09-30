import { describe, expect, it } from "vitest"
import { assertUniqueSurfaceIds, defineSurface } from "./define"

describe("target definitions", () => {
  it("accepts a source-backed surface", () => {
    const surface = defineSurface({
      id: "example-system",
      provider: "openai",
      product: "Example",
      label: "System",
      instructionRole: "system",
      characterLimit: { kind: "unknown" },
      source: {
        label: "Example documentation",
        url: "https://example.com/docs",
        verifiedAt: "2026-09-30"
      }
    })

    expect(surface.id).toBe("example-system")
  })

  it("rejects decorative or unstable ids", () => {
    expect(() =>
      defineSurface({
        id: "Example · System",
        provider: "openai",
        product: "Example",
        label: "System",
        instructionRole: "system",
        characterLimit: { kind: "unknown" },
        source: {
          label: "Example documentation",
          url: "https://example.com/docs",
          verifiedAt: "2026-09-30"
        }
      })
    ).toThrow("lowercase kebab-case")
  })

  it("rejects invalid source metadata", () => {
    expect(() =>
      defineSurface({
        id: "example-system",
        provider: "openai",
        product: "Example",
        label: "System",
        instructionRole: "system",
        characterLimit: { kind: "fixed", value: 1000 },
        source: {
          label: "Example documentation",
          url: "http://example.com/docs",
          verifiedAt: "30-09-2026"
        }
      })
    ).toThrow()
  })

  it("rejects duplicate ids", () => {
    const first = defineSurface({
      id: "example-system",
      provider: "openai",
      product: "Example",
      label: "System",
      instructionRole: "system",
      characterLimit: { kind: "unknown" },
      source: {
        label: "Example documentation",
        url: "https://example.com/docs",
        verifiedAt: "2026-09-30"
      }
    })

    expect(() => assertUniqueSurfaceIds([first, first])).toThrow("Duplicate")
  })
})
