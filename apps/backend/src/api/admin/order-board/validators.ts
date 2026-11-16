import { z } from "@medusajs/framework/zod"
import { BOARD_STAGES, turkishDayStart } from "../../../lib/dashboard"
import {
  CARRIER_FILTERS,
  PAYMENT_FILTERS,
  SHIPPING_FILTERS,
} from "../../../lib/dashboard/board-filters"
import { PAYMENT_METHODS } from "../../../lib/orders/payment-method"

export const ORDER_BOARD_PAGE = 20

/** Whose orders a list shows: the shop's retail ones, the wholesalers', or every one. */
export const ORDER_SEGMENTS = ["retail", "wholesale", "all"] as const
export type OrderSegment = (typeof ORDER_SEGMENTS)[number]

// A Turkish day, `YYYY-MM-DD`, that is a date
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "orders.range_invalid")
  .refine((value) => turkishDayStart(value) !== null, "orders.range_invalid")

/**
 * What the order list is narrowed by, the export too: a tab, Medusa's
 * order search (number, e-mail, name, place), one customer's orders, where
 * the money and the parcel stand (F12.3), how it was paid, who carries it,
 * the days it was placed on (Turkish days, both included; either alone),
 * and whose orders (ADR-0068 Ek 2026-11-15 (2)): retail ones by default,
 * wholesale ones (one wholesaler's), or both (a customer's page).
 */
export const ORDER_FILTER_FIELDS = {
  stage: z.enum(BOARD_STAGES).default("all"),
  q: z.string().trim().max(100).optional(),
  // One customer's orders, for their page
  customer_id: z.string().min(1).max(64).optional(),
  payment: z.enum(PAYMENT_FILTERS).optional(),
  shipping: z.enum(SHIPPING_FILTERS).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  carrier: z.enum(CARRIER_FILTERS).optional(),
  from: day.optional(),
  to: day.optional(),
  segment: z.enum(ORDER_SEGMENTS).default("retail"),
  // One wholesaler's orders, on the wholesale list
  wholesaler: z.string().min(1).max(64).optional(),
}

/** A range runs forwards. */
export function checkDays(
  query: { from?: string | undefined; to?: string | undefined },
  ctx: z.RefinementCtx
): void {
  if (query.from && query.to && query.from > query.to) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "orders.range_invalid" })
  }
}

/** `?stage=&q=&customer_id=&payment=&shipping=&method=&carrier=&from=&to=&segment=&wholesaler=&offset=`. */
export const AdminGetOrderBoard = z
  .object({
    ...ORDER_FILTER_FIELDS,
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
  .superRefine(checkDays)
export type AdminGetOrderBoardType = z.infer<typeof AdminGetOrderBoard>

/** The list's filters, without its page: what the export and a stage read take. */
export type OrderFilters = Omit<AdminGetOrderBoardType, "offset">
