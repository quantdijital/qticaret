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

/** A filter's known choices in a comma text (`paid,refunded`), repeats and unknown ones dropped. */
export function choicesIn<T extends string>(
  values: readonly T[],
  text: string | undefined
): T[] | undefined {
  const kept = [...new Set((text ?? "").split(","))].filter((one): one is T =>
    values.includes(one as T)
  )
  return kept.length > 0 ? kept : undefined
}

/** Choices as the address holds them: a comma text, or nothing for none. */
export const choicesText = (list: readonly string[] | undefined): string | undefined =>
  list && list.length > 0 ? list.join(",") : undefined

/**
 * One or more of a filter's choices as a plain comma text in the address
 * (`payment=paid,refunded`); an older link's single value reads as it is,
 * and a list (an address written as one) is joined. Unknown and repeated
 * choices are dropped; nothing left is no filter.
 */
const choices = (values: readonly string[]) =>
  z
    .preprocess((input) => (Array.isArray(input) ? input.join(",") : input), z.string().max(200))
    .transform((text) => choicesText(choicesIn(values, text)))
    .optional()
    .catch(undefined)

/**
 * The order list's URL: `/orders?stage=to_ship&payment=paid,refunded&shipping=label&method=cod&carrier=aras&from=2026-11-01&to=2026-11-06&customer=cus_01…&q=1042&page=2`
 * (1-based in the URL). Every filter lives here, so a filtered list is a link
 * (one customer's orders: from the order's customer card and their page).
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
  customer: z.string().trim().min(1).max(64).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type OrderListSearch = z.infer<typeof orderListSearchSchema>

/** The address's choices as lists, for the filter bar and the server. */
export const choicesOf = (search: OrderListSearch) => ({
  payment: choicesIn(PAYMENT_FILTERS, search.payment),
  shipping: choicesIn(SHIPPING_FILTERS, search.shipping),
  method: choicesIn(PAYMENT_METHODS, search.method),
  carrier: choicesIn(CARRIER_FILTERS, search.carrier),
})

/** Whether any filter beside the search and the tab is set. */
export const isFiltered = (search: OrderListSearch): boolean => {
  const lists = choicesOf(search)
  return Boolean(
    lists.payment ??
    lists.shipping ??
    lists.method ??
    lists.carrier ??
    search.from ??
    search.to ??
    search.customer
  )
}

/** The address's search without its empty parts: an "all" tab, an empty search or list, page 1. */
export const cleanSearch = (search: OrderListSearch): OrderListSearch => {
  const lists = choicesOf(search)
  return {
    q: search.q === "" ? undefined : search.q,
    stage: search.stage === "all" ? undefined : search.stage,
    payment: choicesText(lists.payment),
    shipping: choicesText(lists.shipping),
    method: choicesText(lists.method),
    carrier: choicesText(lists.carrier),
    from: search.from,
    to: search.to,
    customer: search.customer === "" ? undefined : search.customer,
    page: search.page && search.page > 1 ? search.page : undefined,
  }
}

/** The list's filters as the address holds them. */
export const filtersOf = (search: OrderListSearch): OrderFilters => ({
  stage: search.stage ?? "all",
  q: search.q ?? "",
  ...choicesOf(search),
  from: search.from,
  to: search.to,
  // One customer's orders, wholesale ones too, as on their page (ADR-0068 Ek 2026-11-15 (2))
  ...(search.customer ? { customerId: search.customer, segment: "all" as const } : {}),
})
