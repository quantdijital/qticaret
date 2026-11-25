import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import {
  linkVariantItemsStep,
  planStockTrackingStep,
  setManageInventoryStep,
} from "./steps/stock-tracking"
import type { LinkedItem } from "./steps/stock-tracking"
import type { LevelWrite, TrackingInput, TrackingPlan } from "./tracking-plan"
import { writeStockLevelsWorkflow } from "./write-levels"
import type { WriteStockLevelsInput } from "./write-levels"

// What Medusa's own variant workflow emits: search, SEO and card facts read the variant again
const VARIANT_UPDATED = "product-variant.updated"

type Linked = LinkedItem[]

/** The levels to write: the plan's, and a new item's at the default location. */
function levelsOf(plan: TrackingPlan, linked: Linked, input: TrackingInput): WriteStockLevelsInput {
  const location = plan.location_id
  const fresh: LevelWrite[] = location
    ? plan.link.flatMap((each) => {
        const made = linked.find((row) => row.variant_id === each.variant_id && row.created)
        return made
          ? [
              {
                inventory_item_id: made.inventory_item_id,
                location_id: location,
                stocked_quantity: each.quantity,
              },
            ]
          : []
      })
    : []
  return {
    create: [...plan.create, ...fresh],
    update: plan.update,
    reason: "manual",
    reference: null,
    actor_id: input.actor_id,
  }
}

/**
 * A variant's stock tracking turned on or off after it was made (docs/06
 * "Ürün sayfası", adr/0018 Ek 2026-11-20). On: the variant gets an item
 * (its kept one, an unlinked one with its SKU, or a new one), a level at
 * the shop's default location and the typed count, then the flag. Off:
 * the flag alone; the item and its levels stay, so turning it on again
 * finds the count where it was. Refused off while orders hold its stock.
 * Each write is undone if a later one fails.
 */
export const setStockTrackingWorkflow = createWorkflow(
  "stock-set-tracking",
  (input: WorkflowData<TrackingInput>) => {
    const plan = planStockTrackingStep(input)
    const linked = linkVariantItemsStep(transform({ plan }, ({ plan }) => plan.link))
    const levels = transform({ plan, linked, input }, ({ plan, linked, input }) =>
      levelsOf(plan, linked, input)
    )
    when(
      "stock-tracking-levels",
      { levels },
      ({ levels }) => levels.create.length + levels.update.length > 0
    ).then(() => {
      writeStockLevelsWorkflow.runAsStep({ input: levels })
    })
    const flip = transform({ plan }, ({ plan }) => ({
      ids: plan.flip.map((each) => each.id),
      tracked: plan.tracked,
    }))
    setManageInventoryStep(flip)
    when("stock-tracking-event", { flip }, ({ flip }) => flip.ids.length > 0).then(() => {
      emitEventStep({
        eventName: VARIANT_UPDATED,
        data: transform({ flip }, ({ flip }) => flip.ids.map((id) => ({ id }))),
      })
    })
    return new WorkflowResponse(flip)
  }
)
