import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"
import { syncListRowsWorkflow } from "./sync"
import type { SyncListInput } from "./sync"

export interface ManualPricesInput {
  list: SyncListInput["list"]
  /** Net (KDV excluded) kuruş per variant, as staff entered it. */
  set: { variant_id: string; net_amount: number }[]
  /** Variants whose hand-entered price goes: the rate prices them again, or nothing does. */
  remove: string[]
  created_by: string | null
}

interface MarkBefore {
  id: string
  net_amount: number
}

interface MarksUndo {
  created: string[]
  updated: MarkBefore[]
  removed: string[]
}

const wholesale = (container: MedusaContainer) =>
  container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)

/** Every variant named exists; an unknown one is refused before anything is written. */
const checkVariantsStep = createStep(
  "wholesale-check-variants",
  async (input: { ids: string[] }, { container }) => {
    if (input.ids.length > 0) {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["id"],
        filters: { id: input.ids },
      })
      const known = new Set((data as { id: string }[]).map((row) => row.id))
      if (input.ids.some((id) => !known.has(id))) {
        throw new ValidationError("wholesale.variant_unknown", { field: "variant_id" })
      }
    }
    return new StepResponse(undefined)
  }
)

/** The hand-entered marks written; undone by putting each back as it was. */
const writeMarksStep = createStep(
  "wholesale-write-manual-marks",
  async (input: ManualPricesInput, { container }) => {
    const service = wholesale(container)
    const listId = input.list.price_list_id
    const named = [...input.set.map((each) => each.variant_id), ...input.remove]
    const existing =
      named.length === 0
        ? []
        : await service.listWholesaleManualPrices(
            { price_list_id: listId, variant_id: named },
            { take: null }
          )
    const byVariant = new Map(existing.map((mark) => [mark.variant_id, mark]))
    const undo: MarksUndo = { created: [], updated: [], removed: [] }
    const fresh = input.set.filter((each) => !byVariant.has(each.variant_id))
    if (fresh.length > 0) {
      const created = await service.createWholesaleManualPrices(
        fresh.map((each) => ({ ...each, price_list_id: listId, created_by: input.created_by }))
      )
      undo.created = created.map((mark) => mark.id)
    }
    const changed = input.set.flatMap((each) => {
      const mark = byVariant.get(each.variant_id)
      return mark && mark.net_amount !== each.net_amount ? [{ mark, each }] : []
    })
    if (changed.length > 0) {
      await service.updateWholesaleManualPrices(
        changed.map(({ mark, each }) => ({
          id: mark.id,
          net_amount: each.net_amount,
          created_by: input.created_by,
        }))
      )
      undo.updated = changed.map(({ mark }) => ({ id: mark.id, net_amount: mark.net_amount }))
    }
    const removed = input.remove.flatMap((variantId) => byVariant.get(variantId)?.id ?? [])
    if (removed.length > 0) {
      await service.softDeleteWholesaleManualPrices(removed)
      undo.removed = removed
    }
    return new StepResponse(
      { written: fresh.length + changed.length, removed: removed.length },
      undo
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = wholesale(container)
    if (undo.created.length > 0) {
      await service.deleteWholesaleManualPrices(undo.created)
    }
    if (undo.updated.length > 0) {
      await service.updateWholesaleManualPrices(undo.updated)
    }
    if (undo.removed.length > 0) {
      await service.restoreWholesaleManualPrices(undo.removed)
    }
  }
)

/**
 * Prices entered by hand, KDV excluded (ADR-0068 §4): kept as entered,
 * then the list's rows of those variants written from them with each
 * variant's KDV rate. A rate never overwrites them; taken away, the rate
 * prices the variant again. The amounts are staff's input, never a
 * shopper's.
 */
export const setManualPricesWorkflow = createWorkflow(
  "wholesale-set-manual-prices",
  (input: ManualPricesInput) => {
    const ids = transform({ input }, ({ input }) => [
      ...new Set([...input.set.map((each) => each.variant_id), ...input.remove]),
    ])
    checkVariantsStep(transform({ ids }, ({ ids }) => ({ ids })))
    const marks = writeMarksStep(input)
    const rows = syncListRowsWorkflow.runAsStep({
      input: transform({ input, ids }, ({ input, ids }) => ({
        list: input.list,
        scope: { ids },
      })),
    })
    return new WorkflowResponse(
      transform({ marks, rows }, ({ marks, rows }) => ({ ...marks, rows }))
    )
  }
)
