import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { liraToKurus } from "../../../../validation/lira"
import type { OrderEditInput } from "../../../../../workflows/orders/edit-order"
import type { AdminPostOrderEditPreviewType } from "./validators"

/** The request as the edit workflows take it: prices in kuruş. */
export const editInputOf = (
  req: AuthenticatedMedusaRequest<AdminPostOrderEditPreviewType>
): OrderEditInput => ({
  order_id: req.params["id"] ?? "",
  staff_id: req.auth_context.actor_id,
  note: req.validatedBody.note ?? null,
  items: req.validatedBody.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    ...(item.unit_price === undefined ? {} : { unit_price: liraToKurus(item.unit_price) }),
  })),
  add: req.validatedBody.add,
})
