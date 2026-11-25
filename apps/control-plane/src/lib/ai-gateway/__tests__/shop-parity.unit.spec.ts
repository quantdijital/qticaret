import { join } from "node:path"
import { AI_CREDIT_TASKS, AI_SERVICE_TARGETS } from "@qticaret/types/control-plane"
import type { AiCapabilityTarget, AiServiceTarget } from "@qticaret/types/control-plane"
import { AI_TASK_LIMITS } from "../limits"

/**
 * The gateway's limits and prices against the shop's own registry
 * (apps/backend lib/ai), loaded at run time: the shop builds the bodies
 * the gateway cuts, so a budget the shop asks for must never be cut, and
 * the gateway's price and "not taken" rule must be the shop's. Not
 * imported statically: the app's TypeScript root ends here.
 */

interface ShopTask {
  id: string
  capability: string
  maxTokens?: number
}
interface ShopTarget {
  connector: string
  body?: Readonly<Record<string, unknown>>
  maxTokensField?: string | null
  scene?: { unitPrice?: unknown }
}
interface ShopService {
  id: string
  capabilities: Record<string, ShopTarget>
  unitPrices: Record<string, unknown>
  bodyErrors?: Record<number, string>
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names what it loads
const shop = <T>(path: string): T =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a path outside this app's root, test only
  require(join(__dirname, "../../../../../backend/src/lib/ai", path)) as T

const { aiTasks } = shop<{ aiTasks: (env: string) => readonly ShopTask[] }>("registry/tasks")
const { ASSISTANT_TASK } = shop<{ ASSISTANT_TASK: ShopTask }>("registry/assistant-tasks")
const { maxTokensOf } = shop<{ maxTokensOf: (task: ShopTask) => number }>("run-text")
const { aiServices } = shop<{ aiServices: (env: string) => readonly ShopService[] }>(
  "registry/services"
)
const { notTakenByService } = shop<{
  notTakenByService: (key: string, code: string | null) => boolean
}>("outcome")

const targets = AI_SERVICE_TARGETS as Readonly<Record<string, AiServiceTarget>>

describe("the gateway against the shop's registry (adr/0085 K2)", () => {
  const tasks = [...aiTasks("production"), ASSISTANT_TASK]

  it("has a limit row for every credit task and no other", () => {
    expect(Object.keys(AI_TASK_LIMITS).sort()).toEqual([...AI_CREDIT_TASKS].sort())
  })

  it("never cuts an output budget the shop asks for", () => {
    for (const task of tasks.filter((each) => Object.hasOwn(AI_TASK_LIMITS, each.id))) {
      const limit = AI_TASK_LIMITS[task.id as keyof typeof AI_TASK_LIMITS].maxOutputTokens
      if (task.capability === "image_edit") {
        expect([task.id, limit]).toEqual([task.id, null])
      } else {
        // The shop's budget exactly: a larger ask is cut, the shop's own passes as it is
        expect([task.id, limit]).toEqual([task.id, maxTokensOf(task)])
      }
    }
  })

  it("writes the shop's output field and prices for each service", () => {
    for (const service of aiServices("production")) {
      const shared = targets[service.id]
      expect(shared).toBeDefined()
      for (const [capability, target] of Object.entries(service.capabilities)) {
        const ours: AiCapabilityTarget | undefined = shared?.capabilities[capability as "text"]
        if (target.maxTokensField !== undefined) {
          expect([service.id, capability, ours?.maxTokensField]).toEqual([
            service.id,
            capability,
            target.maxTokensField,
          ])
        }
        expect(ours?.price).toEqual(service.unitPrices[capability])
        if (target.scene?.unitPrice !== undefined) {
          expect(ours?.scene?.price).toEqual(target.scene.unitPrice)
        }
      }
    }
  })

  it("writes the shop's fixed body fields for each chat target, and no other", () => {
    for (const service of aiServices("production")) {
      for (const [capability, target] of Object.entries(service.capabilities)) {
        if (target.connector !== "openai-compatible") {
          continue
        }
        const ours = targets[service.id]?.capabilities[capability as "text"]
        expect([service.id, capability, ours?.fixedBody]).toEqual([
          service.id,
          capability,
          target.body,
        ])
      }
    }
  })

  it("gives credits back on the body codes the shop gives its quota back on", () => {
    for (const service of aiServices("production")) {
      const codes = Object.entries(service.bodyErrors ?? {})
        .filter(([code, key]) => notTakenByService(key, `body_${code}`))
        .map(([code]) => Number(code))
        .sort((a, b) => a - b)
      expect([service.id, [...(targets[service.id]?.notTakenBodyCodes ?? [])]]).toEqual([
        service.id,
        codes,
      ])
    }
  })
})
