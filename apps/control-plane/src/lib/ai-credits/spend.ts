import type { MedusaContainer } from "@medusajs/framework/types"
import {
  AI_TASK_CAPABILITIES,
  aiOperationIdSchema,
  isAiCreditTask,
} from "@qticaret/types/control-plane"
import type { AiCreditCapability } from "@qticaret/types/control-plane"
import type { OperationMeasures, SpendOutcome } from "../../modules/ai-credits/service-operations"
import { aiCreditsIn } from "../../workflows/modules"
import { withCurrentMonth } from "./rollover"

type Container = Pick<MedusaContainer, "resolve">

export interface SpendInput {
  tenantId: string
  /** The shop's id for the operation (a UUID), the same on each of its calls. */
  operationId: string
  /** The task's name as the shop says it; what it costs is the platform's table's. */
  task: string
  /** What the call runs as; the task's own first capability when not given. */
  capability?: string
  now: Date
}

/** A call on credits: charged, a later call of the same operation, or why not (adr/0085 §1). */
export type SpendResult = SpendOutcome | { kind: "not_offered" }

/**
 * One call of an operation on the platform's credits (adr/0085 §1, K3,
 * K4). The credits are `AI_TASK_CREDITS[task]`: the caller names the task
 * and never a price, and a task not in the table is `not_offered`. A
 * capability the task may not call as is `task_mismatch` (a cheap task's
 * name never buys a dear call). Everything else is the wallet's single
 * statement (`spend` in the module).
 */
export async function spend(container: Container, input: SpendInput): Promise<SpendResult> {
  const { tenantId, task, now } = input
  if (!isAiCreditTask(task)) {
    return { kind: "not_offered" }
  }
  const operationId = aiOperationIdSchema.parse(input.operationId)
  const allowed = AI_TASK_CAPABILITIES[task]
  const capability = (input.capability ?? allowed[0]) as AiCreditCapability
  if (!allowed.includes(capability)) {
    return { kind: "task_mismatch" }
  }
  const credits = aiCreditsIn(container)
  return await withCurrentMonth(container, tenantId, now, (clock) =>
    credits.spend({ tenantId, operationId, task, capability }, clock)
  )
}

/**
 * An open operation's credits given back, to the buckets they came from
 * (the provider did not take the work). Idempotent: an operation released
 * or settled already changes nothing (`released: false`).
 */
export async function release(
  container: Container,
  input: { tenantId: string; operationId: string; now: Date }
): Promise<{ released: boolean; plan: number; purchased: number }> {
  const credits = aiCreditsIn(container)
  return await withCurrentMonth(container, input.tenantId, input.now, (clock) =>
    credits.release(input.tenantId, input.operationId, clock)
  )
}

/** An open operation kept, with its call's measures and estimated cost; idempotent. */
export async function settle(
  container: Container,
  input: { tenantId: string; operationId: string; measures: OperationMeasures; now: Date }
): Promise<{ settled: boolean }> {
  return await aiCreditsIn(container).settle(
    input.tenantId,
    input.operationId,
    input.measures,
    input.now
  )
}
