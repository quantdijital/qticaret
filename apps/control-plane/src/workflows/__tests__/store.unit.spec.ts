import { readdirSync } from "node:fs"
import { join } from "node:path"
import { WorkflowManager } from "@medusajs/framework/orchestration"

/**
 * No control plane workflow keeps an execution record (adr/0061 §4.3,
 * adr/0027): their inputs hold invited addresses, tokens, a shop's
 * contacts and company, its secrets on the way to their store. Every
 * workflow under `src/workflows` is found here, so a new one without
 * `store: false` fails (Ek C19 I1: the staff invitation's was missing).
 */

const ROOT = join(__dirname, "..")

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sources(path)
    }
    return entry.name.endsWith(".ts") ? [path] : []
  })
}

interface WorkflowExport {
  getName: () => string
}

const isWorkflow = (value: unknown): value is WorkflowExport =>
  typeof value === "function" && typeof (value as Partial<WorkflowExport>).getName === "function"

function workflowNames(): string[] {
  const names: string[] = []
  for (const path of sources(ROOT)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exported = require(path) as Record<string, unknown>
    for (const value of Object.values(exported)) {
      if (isWorkflow(value)) {
        names.push(value.getName())
      }
    }
  }
  return [...new Set(names)].sort()
}

describe("control plane workflows (Ek C19 I1)", () => {
  const names = workflowNames()

  it("finds them all, the staff invitation's among them", () => {
    expect(names.length).toBeGreaterThanOrEqual(30)
    expect(names).toContain("cp-staff-invite")
    expect(names).toContain("cp-staff-accept-invite")
  })

  it("keeps no execution record of any", () => {
    const manager = WorkflowManager as unknown as {
      getWorkflow: (name: string) => { options?: { store?: unknown } } | undefined
    }
    const stored = names.filter((name) => manager.getWorkflow(name)?.options?.store !== false)
    expect(stored).toEqual([])
  })
})
