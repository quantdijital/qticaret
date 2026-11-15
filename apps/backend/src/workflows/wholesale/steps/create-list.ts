import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { GROUPS_RULE } from "../../../lib/wholesale"

/**
 * A wholesale `override` price list for one group, with no row yet
 * (ADR-0068 §2, Ek 2026-11-15), through the pricing module, which takes
 * the list's type as its own admin route does. Undone by deleting it.
 */
export const createWholesaleListStep = createStep(
  "wholesale-create-list",
  async (input: { title: string; customer_group_id: string }, { container }) => {
    const [list] = await container.resolve(Modules.PRICING).createPriceLists([
      {
        title: input.title,
        description: "",
        type: "override",
        status: "active",
        rules: { [GROUPS_RULE]: [input.customer_group_id] },
      },
    ])
    if (!list) {
      throw new Error("createPriceLists returned no list")
    }
    return new StepResponse({ id: list.id }, list.id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve(Modules.PRICING).deletePriceLists([id])
    }
  }
)
