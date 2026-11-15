import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { GROUPS_RULE, planListRows } from "../../lib/wholesale"
import type { ListPlan, PlanList } from "../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"
import type { WholesaleList } from "../../modules/wholesale/service"
import { VARIANT_PAGE, manualPrices, planRows, planVariants, wholesaleContext } from "./context"
import { createListRowsStep, deleteListRowsStep, updateListRowsStep } from "./steps/write-rows"
import type { RowWriteBase } from "./steps/write-rows"

export interface SyncListInput {
  list: PlanList & { customer_group_id: string }
  /** These variants, or a page of every variant (`skip`, by id order). */
  scope: { ids: string[] } | { skip: number }
}

interface Planned {
  base: RowWriteBase
  plan: ListPlan
  /** Variants read: fewer than a page means the last page. */
  read: number
}

/** Reads what the list's rows should be for the scope's variants; read only. */
const planSyncStep = createStep(
  "wholesale-plan-list-rows",
  async (input: SyncListInput, { container }) => {
    const context = await wholesaleContext(container)
    const { variants, read } = await planVariants(container, context, input.scope)
    const [rows, manual] = await Promise.all([
      planRows(container, context.currency, variants),
      manualPrices(
        container,
        input.list.price_list_id,
        variants.map((variant) => variant.id)
      ),
    ])
    const planned: Planned = {
      base: {
        price_list_id: input.list.price_list_id,
        currency_code: context.currency,
        rules:
          input.list.kind === "private" ? { [GROUPS_RULE]: input.list.customer_group_id } : null,
      },
      plan: planListRows(input.list, variants, rows, manual),
      read,
    }
    return new StepResponse(planned)
  }
)

/**
 * A wholesale list's rows for some variants written as they should be
 * (ADR-0068 §4): the rate's price, a hand-entered price worked out with
 * the variant's KDV rate, or none. One list at a time; every write is
 * undone if a later one fails.
 */
export const syncListRowsWorkflow = createWorkflow(
  "wholesale-sync-list-rows",
  (input: SyncListInput) => {
    const lock = transform({ input }, ({ input }) => `wholesale-list:${input.list.price_list_id}`)
    acquireLockStep({ key: lock, timeout: 30, ttl: 120 })
    const planned = planSyncStep(input)
    const writes = transform({ planned }, ({ planned: { base, plan } }) => ({
      create: { ...base, rows: plan.create },
      update: { ...base, rows: plan.update },
      remove: { ...base, rows: plan.delete },
    }))
    createListRowsStep(transform({ writes }, ({ writes }) => writes.create))
    updateListRowsStep(transform({ writes }, ({ writes }) => writes.update))
    deleteListRowsStep(transform({ writes }, ({ writes }) => writes.remove))
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ planned }, ({ planned: { plan, read } }) => ({
        created: plan.create.length,
        updated: plan.update.length,
        deleted: plan.delete.length,
        read,
      }))
    )
  }
)

const toInput = (list: WholesaleList): SyncListInput["list"] => ({
  kind: list.kind,
  price_list_id: list.price_list_id,
  customer_group_id: list.customer_group_id,
  rate_bps: list.rate_bps,
})

export interface SyncCounts {
  created: number
  updated: number
  deleted: number
}

const add = (a: SyncCounts, b: SyncCounts): SyncCounts => ({
  created: a.created + b.created,
  updated: a.updated + b.updated,
  deleted: a.deleted + b.deleted,
})

export const NO_CHANGES: SyncCounts = { created: 0, updated: 0, deleted: 0 }

/** Every variant of the shop through one list, a page at a time. */
export async function syncWholeList(
  container: MedusaContainer,
  list: WholesaleList,
  onPage?: (variantsDone: number) => Promise<void>
): Promise<SyncCounts> {
  let counts = NO_CHANGES
  for (let skip = 0; ;) {
    const { result } = await syncListRowsWorkflow(container).run({
      input: { list: toInput(list), scope: { skip } },
    })
    counts = add(counts, result)
    skip += result.read
    await onPage?.(skip)
    if (result.read < VARIANT_PAGE) {
      return counts
    }
  }
}

/**
 * These variants through the wholesale lists: a variant's own price
 * changed, or it is new. `ratedOnly`: only lists with a rate, the ones a
 * variant's own price moves.
 */
export async function syncVariants(
  container: MedusaContainer,
  variantIds: string[],
  options: { ratedOnly?: boolean } = {}
): Promise<SyncCounts> {
  if (variantIds.length === 0) {
    return NO_CHANGES
  }
  const lists = (
    await container.resolve<WholesaleModuleService>(WHOLESALE_MODULE).wholesaleLists()
  ).filter((list) => !options.ratedOnly || list.rate_bps !== null)
  let counts = NO_CHANGES
  for (const list of lists) {
    const { result } = await syncListRowsWorkflow(container).run({
      input: { list: toInput(list), scope: { ids: variantIds } },
    })
    counts = add(counts, result)
  }
  return counts
}

/**
 * The lists asked to be written again and not yet written since: the
 * sync job works them through, then looks again, as a request may come
 * while it runs. A list's request is met by a run that started after it.
 */
export async function pendingLists(container: MedusaContainer): Promise<WholesaleList[]> {
  const lists = await container.resolve<WholesaleModuleService>(WHOLESALE_MODULE).wholesaleLists()
  return lists.filter(
    (list) =>
      list.sync_requested_at !== null &&
      (list.synced_at === null || list.synced_at < list.sync_requested_at)
  )
}
