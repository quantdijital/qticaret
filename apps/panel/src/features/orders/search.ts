import { z } from "zod"
import {
  CARRIER_FILTERS,
  ORDER_STAGES,
  PAYMENT_FILTERS,
  PAYMENT_METHODS,
  SHIPPING_FILTERS,
} from "./api/orders"

// A Turkish day as the server takes it; anything else is dropped from the address
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

/**
 * The order list's URL: `/orders?stage=to_ship&payment=paid&shipping=label&method=cod&carrier=aras&from=2026-11-01&to=2026-11-06&q=1042&page=2`
 * (1-based in the URL). Every filter lives here, so a filtered list is a link.
 */
export const orderListSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  stage: z.enum(ORDER_STAGES).optional().catch(undefined),
  payment: z.enum(PAYMENT_FILTERS).optional().catch(undefined),
  shipping: z.enum(SHIPPING_FILTERS).optional().catch(undefined),
  method: z.enum(PAYMENT_METHODS).optional().catch(undefined),
  carrier: z.enum(CARRIER_FILTERS).optional().catch(undefined),
  from: day,
  to: day,
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type OrderListSearch = z.infer<typeof orderListSearchSchema>

/** Whether any filter beside the search and the tab is set. */
export const isFiltered = (search: OrderListSearch): boolean =>
  Boolean(
    search.payment ?? search.shipping ?? search.method ?? search.carrier ?? search.from ?? search.to
  )
