import {
  AI_CALLS_PER_OPERATION,
  AI_TASKS_WITHOUT_CREDITS,
  AI_TASK_CAPABILITIES,
  AI_TASK_CREDITS,
  aiCallCap,
  isAiCreditTask,
} from "@qticaret/types/control-plane"
import type { AiCreditCapability } from "@qticaret/types/control-plane"
import { ASSISTANT_TASK } from "../registry/assistant-tasks"
import { SEARCH_INTENT_TASK } from "../registry/search-tasks"
import { aiTasks, runsAs } from "../registry/tasks"
import type { AiTask } from "../registry/tasks"

/**
 * adr/0085 K4: the platform credits' table is the shared one, the shop's
 * registry names the tasks. Every task the shop can run (the test one,
 * the assistant and the storefront search included) is either priced or
 * kept off the credits on purpose, never both; the table names no task the
 * shop lacks; and each priced task may call as the capability it runs as.
 */
const everyTask = (): readonly AiTask[] => [
  ...aiTasks("test"),
  ...aiTasks("production"),
  ASSISTANT_TASK,
  SEARCH_INTENT_TASK,
]

const ids = (): string[] => [...new Set(everyTask().map((task) => task.id))].sort()
const offCredits = Object.keys(AI_TASKS_WITHOUT_CREDITS)

describe("the AI credit table against the shop's tasks (adr/0085)", () => {
  it("prices every task or keeps it off on purpose, never both", () => {
    const unplaced = ids().filter((id) => !isAiCreditTask(id) && !offCredits.includes(id))
    const both = ids().filter((id) => isAiCreditTask(id) && offCredits.includes(id))

    // Listed here: add them to AI_TASK_CREDITS or AI_TASKS_WITHOUT_CREDITS
    expect(unplaced).toEqual([])
    expect(both).toEqual([])
  })

  it("names no task the shop does not have", () => {
    const known = new Set(ids())

    expect(Object.keys(AI_TASK_CREDITS).filter((id) => !known.has(id))).toEqual([])
    expect(offCredits.filter((id) => !known.has(id))).toEqual([])
  })

  it("lets each priced task call as what it runs as, under a call cap", () => {
    for (const task of everyTask().filter((each) => isAiCreditTask(each.id))) {
      const id = task.id as keyof typeof AI_TASK_CAPABILITIES
      const allowed: readonly AiCreditCapability[] = AI_TASK_CAPABILITIES[id]
      const runs = allowed.filter((capability) => runsAs(task, capability))

      // Its own capability is allowed, and nothing it may not run as
      expect([id, allowed.includes(task.capability as AiCreditCapability)]).toEqual([id, true])
      expect([id, runs]).toEqual([id, allowed])
      for (const capability of allowed) {
        expect(AI_CALLS_PER_OPERATION[capability]).toBeGreaterThanOrEqual(1)
      }
      expect(aiCallCap(id)).toBeGreaterThanOrEqual(1)
    }
  })

  it("keeps the storefront search off the credits (K10)", () => {
    expect(isAiCreditTask(SEARCH_INTENT_TASK.id)).toBe(false)
    expect(offCredits).toContain(SEARCH_INTENT_TASK.id)
  })
})
