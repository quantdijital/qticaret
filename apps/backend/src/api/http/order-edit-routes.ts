import { validateAndTransformBody } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { isBillingLocked } from "../../lib/invoicing/billing-lock"
import { AdminPostOrderEdit, AdminPostOrderEditPreview } from "../admin/orders/[id]/edit/validators"
import { existingOrderAddresses, validateTrAddresses } from "../validation/tr-address"
import { requireUserActor } from "./actor"
import { holdCancelLocks } from "./bank-transfer-routes"
import { refuseSellingEdit } from "./plan-guard"

/**
 * Medusa's own order edits skip the difference and its refund (adr/0033):
 * their changes are closed; ours run Medusa's workflows themselves.
 */
function refuseCoreOrderEdit(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  next(req.method === "GET" ? undefined : new ValidationError("orders.use_order_edit"))
}

/** A packed parcel's label carries the old address: the delivery address stays once packed. */
async function keepAddressOncePacked(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = req.validatedBody as { shipping_address?: unknown } | undefined
  if (req.method !== "POST" || body?.shipping_address === undefined) {
    next()
    return
  }
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["fulfillments.canceled_at"],
      filters: { id: req.params["id"] ?? "" },
    })
    const packed = (
      (data[0] as { fulfillments?: ({ canceled_at?: unknown } | null)[] | null } | undefined)
        ?.fulfillments ?? []
    ).some((fulfillment) => fulfillment && !fulfillment.canceled_at)
    next(packed ? new ValidationError("orders.edit_after_packing") : undefined)
  } catch (error) {
    next(error)
  }
}

/**
 * An issued (or issuing) sale invoice names the buyer as it was: the billing
 * address stays, as the panel's order page shows it (PR #413).
 */
async function keepBillingOnceInvoiced(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = req.validatedBody as { billing_address?: unknown } | undefined
  if (req.method !== "POST" || body?.billing_address === undefined) {
    next()
    return
  }
  try {
    const locked = await isBillingLocked(req.scope, req.params["id"] ?? "")
    next(locked ? new ValidationError("orders.billing_invoiced") : undefined)
  } catch (error) {
    next(error)
  }
}

/** F7.12 (adr/0033): staff edit an order's lines and addresses. */
export const ORDER_EDIT_ROUTES = [
  {
    matcher: "/admin/orders/:id/edit/preview",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostOrderEditPreview)],
  },
  {
    matcher: "/admin/orders/:id/edit",
    methods: ["POST" as const],
    // adr/0061 Ek C15 (review L1): a restricted shop's edit sells nothing new
    middlewares: [
      requireUserActor,
      validateAndTransformBody(AdminPostOrderEdit),
      refuseSellingEdit,
    ],
  },
  // Medusa's own address update: staff only, Turkish addresses checked, not once packed
  {
    matcher: "/admin/orders/:id",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      // Not while "Kargoya ver" buys a label with the old address
      holdCancelLocks,
      keepAddressOncePacked,
      // Nor the billing address once the sale invoice is issued or issuing
      keepBillingOnceInvoiced,
      validateTrAddresses(["shipping_address", "billing_address"], existingOrderAddresses),
    ],
  },
  ...["/admin/order-edits", "/admin/order-edits/*"].map((matcher) => ({
    matcher,
    middlewares: [refuseCoreOrderEdit],
  })),
]
