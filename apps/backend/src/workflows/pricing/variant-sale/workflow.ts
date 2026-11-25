import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createPriceListsWorkflow,
  deletePriceListsWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { planVariantSales } from "./plan"
import type { VariantSaleInput, VariantSalePlan } from "./plan"
import { productSaleFacts, shopCurrency } from "./read"

/** Reads the product's prices and its sales and works out what to write; read only, nothing to undo. */
const planVariantSalesStep = createStep(
  "variant-sale-plan",
  async (input: VariantSaleInput, { container }) => {
    const currency = await shopCurrency(container)
    const facts = await productSaleFacts(container, input.product_id, currency)
    const plan: VariantSalePlan = planVariantSales(input, {
      currency,
      product_title: facts.title,
      variants: facts.variants,
      existing: facts.existing,
      now: new Date(),
    })
    return new StepResponse(plan)
  }
)

/**
 * A product's variants' sale prices set, changed or cleared (adr/0086):
 * each sale is a Medusa `sale` price list of its own, with the sale's
 * days. The new lists are made first and the replaced ones deleted after,
 * so a sale never lapses to the full price in between; Medusa's own
 * workflows undo each part (a made list deleted, a deleted one restored)
 * if a later one fails. The amounts are checked against the variant's own
 * price here, and a share off is worked out here, never taken from the
 * client as a total. One run at a time per product.
 */
export const setVariantSalesWorkflow = createWorkflow(
  "variant-sale-set",
  (input: VariantSaleInput) => {
    const lock = transform({ input }, ({ input }) => `variant-sale:${input.product_id}`)
    acquireLockStep({ key: lock, timeout: 5, ttl: 300 })
    const plan = planVariantSalesStep(input)
    when("variant-sale-create", { plan }, ({ plan }) => plan.create.length > 0).then(() => {
      createPriceListsWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => ({ price_lists_data: plan.create })),
      })
    })
    when("variant-sale-remove", { plan }, ({ plan }) => plan.remove.length > 0).then(() => {
      deletePriceListsWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => ({ ids: plan.remove })),
      })
    })
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ plan }, ({ plan }) => ({
        written: plan.create.map((list) => list.metadata.variant_id),
        removed: plan.remove.length,
        unchanged: plan.unchanged,
      }))
    )
  }
)
