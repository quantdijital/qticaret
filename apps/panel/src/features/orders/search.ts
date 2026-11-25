import { z } from "zod"
import type { OrderFilters } from "./api/orders"
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
 * One or more of a filter's choices: a list, or the single value
 * (`payment=paid`) and comma list older and hand-written links have.
 * Unknown and repeated choices are dropped; nothing left is no filter.
 */
const choices = <T extends string>(values: readonly T[]) =>
  z
    .preprocess(
      (input) => (typeof input === "string" ? input.split(",") : input),
      z.array(z.string()).max(20)
    )
    .transform((list): T[] | undefined => {
      const kept = [...new Set(list)].filter((one): one is T => values.includes(one as T))
      return kept.length > 0 ? kept : undefined
    })
    .optional()
    .catch(undefined)

/**
 * The order list's URL: `/orders?stage=to_ship&payment=["paid","refunded"]&shipping=["label"]&method=["cod"]&carrier=["aras"]&from=2026-11-01&to=2026-11-06&q=1042&page=2`
 * (1-based in the URL; `payment=paid` as older links have it still reads).
 * Every filter lives here, so a filtered list is a link.
 */
export const orderListSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  stage: z.enum(ORDER_STAGES).optional().catch(undefined),
  payment: choices(PAYMENT_FILTERS),
  shipping: choices(SHIPPING_FILTERS),
  method: choices(PAYMENT_METHODS),
  carrier: choices(CARRIER_FILTERS),
  from: day,
  to: day,
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type OrderListSearch = z.infer<typeof orderListSearchSchema>

/** A list of choices, or nothing when it is empty. */
const some = <T>(list: T[] | undefined): T[] | undefined =>
  list && list.length > 0 ? list : undefined

/** Whether any filter beside the search and the tab is set. */
export const isFiltered = (search: OrderListSearch): boolean =>
  Boolean(
    some(search.payment) ??
    some(search.shipping) ??
    some(search.method) ??
    some(search.carrier) ??
    search.from ??
    search.to
  )

/** The address's search without its empty parts: an "all" tab, an empty search or list, page 1. */
export const cleanSearch = (search: OrderListSearch): OrderListSearch => ({
  q: search.q === "" ? undefined : search.q,
  stage: search.stage === "all" ? undefined : search.stage,
  payment: some(search.payment),
  shipping: some(search.shipping),
  method: some(search.method),
  carrier: some(search.carrier),
  from: search.from,
  to: search.to,
  page: search.page && search.page > 1 ? search.page : undefined,
})

/** The list's filters as the address holds them. */
export const filtersOf = (search: OrderListSearch): OrderFilters => ({
  stage: search.stage ?? "all",
  q: search.q ?? "",
  payment: search.payment,
  shipping: search.shipping,
  method: search.method,
  carrier: search.carrier,
  from: search.from,
  to: search.to,
})
