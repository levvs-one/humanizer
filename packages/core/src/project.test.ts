import { describe, expect, it } from "vitest"
import {
  createProjectDocument,
  duplicateProjectDocument,
  parseProjectDocument,
  serializeProjectDocument,
  updateProjectDocument
} from "./project"

describe("project documents", () => {
  it("creates a versioned project scope", () => {
    const project = createProjectDocument({
      id: "payments",
      name: "Payments",
      description: "Payment service work.",
      behaviorOverrides: {
        "research.rigor": 100,
        "communication.verbosity": "low"
      },
      now: "2026-09-30T20:00:00.000Z"
    })

    expect(project.schemaVersion).toBe(1)
    expect(project.id).toBe("payments")
    expect(project.behaviorOverrides["research.rigor"]).toBe(100)
    expect(project.createdAt).toBe(project.updatedAt)
  })

  it("round-trips through the project format", () => {
    const project = createProjectDocument({
      id: "payments",
      name: "Payments",
      behaviorOverrides: {
        role: "Payments platform engineer"
      },
      now: "2026-09-30T20:00:00.000Z"
    })

    expect(parseProjectDocument(serializeProjectDocument(project))).toEqual(project)
  })

  it("updates scope without changing creation time", () => {
    const project = createProjectDocument({
      id: "payments",
      name: "Payments",
      now: "2026-09-30T20:00:00.000Z"
    })

    const updated = updateProjectDocument(
      project,
      {
        behaviorOverrides: {
          "reasoning.verification": 100
        }
      },
      "2026-09-30T21:00:00.000Z"
    )

    expect(updated.createdAt).toBe(project.createdAt)
    expect(updated.updatedAt).toBe("2026-09-30T21:00:00.000Z")
    expect(updated.behaviorOverrides["reasoning.verification"]).toBe(100)
  })

  it("duplicates as an independent scope", () => {
    const project = createProjectDocument({
      id: "payments",
      name: "Payments",
      behaviorOverrides: {
        "reasoning.initiative": 90
      }
    })

    const copy = duplicateProjectDocument(project)

    expect(copy.id).not.toBe(project.id)
    expect(copy.name).toBe("Payments Copy")
    expect(copy.behaviorOverrides).toEqual(project.behaviorOverrides)
  })

  it("rejects invalid project overrides", () => {
    const project = createProjectDocument({
      id: "payments",
      name: "Payments"
    })

    expect(() =>
      parseProjectDocument(
        JSON.stringify({
          ...project,
          behaviorOverrides: {
            "communication.verbosity": "extreme"
          }
        })
      )
    ).toThrow("invalid or incomplete")
  })
})
