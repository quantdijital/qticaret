import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { saleRefOf } from "../../lib/invoicing/birfatura"
import { decideCargo } from "../../lib/shipping/birfatura-cargo"
import type {
  CargoDecision,
  CargoOrderFacts,
  CargoTracking,
} from "../../lib/shipping/birfatura-cargo"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import { shipOrderWorkflow } from "../orders/ship-order"

export interface BirfaturaCargoInput {
  /** BirFatura's `orderId`: the order's number, or an exchange's own id (adr/0072 §5). */
  birfatura_order_id: number
  /** Null: the number it sent is not one a carrier gives (`readCargoTracking`). */
  tracking: CargoTracking | null
}

/**
 * Which order BirFatura names and what its number does to it
 * (`decideCargo`): strictly an order whose sale invoice BirFatura pulled
 * from us, never an order found by its number alone. Reads only.
 */
export const decideBirfaturaCargoStep = createStep(
  "shipping-birfatura-cargo-decide",
  async (input: BirfaturaCargoInput, { container }) => {
    const ref = saleRefOf(input.birfatura_order_id)
    if (!ref) {
      return new StepResponse<CargoDecision>(
        decideCargo({ order: null, exchange: false, pulled: false, tracking: input.tracking })
      )
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "id",
        "status",
        "canceled_at",
        "fulfillments.canceled_at",
        "fulfillments.labels.tracking_number",
      ],
      // Query takes the number as text, as `store/order-lookup` does
      filters: { display_id: String(ref.display_id) },
    })
    const order = (data[0] as CargoOrderFacts | undefined) ?? null
    const sale =
      order && ref.exchange === 0
        ? await container
            .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
            .birfaturaSale(order.id, order.id)
        : null
    return new StepResponse<CargoDecision>(
      decideCargo({
        order,
        exchange: ref.exchange > 0,
        pulled: Boolean(sale?.listed_at),
        invoiceCancelled: sale?.status === "cancelled" || Boolean(sale?.cancel_requested_at),
        tracking: input.tracking,
      })
    )
  }
)

/**
 * BirFatura's cargo module handed the parcel over and wrote its tracking
 * back (adr/0072 Ek 2026-11-26): the order ships whole, as "Kargoya ver"
 * with a typed tracking does (a parcel, its hand-over with the number,
 * carrier name and link, the customer's e-mail), undone together if any
 * part fails. One run per order at a time: the same number sent twice
 * finds its parcel and ships nothing again.
 */
export const birfaturaCargoWorkflow = createWorkflow(
  "shipping-birfatura-cargo",
  (input: BirfaturaCargoInput) => {
    const lockKey = transform(
      { input },
      ({ input }) => `shipping:birfatura-cargo:${String(input.birfatura_order_id)}`
    )
    // The ship workflow's own lock comes after, under another key
    acquireLockStep({ key: lockKey, timeout: 15, ttl: 120 })
    const decision = decideBirfaturaCargoStep(input)
    when(
      "shipping-birfatura-cargo-ship",
      { decision },
      ({ decision }) => decision.action === "ship"
    ).then(() => {
      shipOrderWorkflow.runAsStep({
        input: transform({ input, decision }, ({ input, decision }) => ({
          order_id: decision.order_id ?? "",
          notify: true,
          tracking: input.tracking,
        })),
      })
    })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(decision)
  }
)
