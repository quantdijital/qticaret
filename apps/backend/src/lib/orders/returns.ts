/**
 * What a shopper may still send back (F7.9, adr/0032): of each line, what
 * was shipped, less what earlier requests already asked for (or Medusa's
 * own returns hold, whichever is more); and for how long: 14 days after
 * the last parcel arrived (the distance-sale withdrawal period; the
 * shop's own terms come with F13). A parcel still on its way can be asked
 * about already; one never marked delivered counts as arrived 30 days
 * after it left. Pure, so tested on its own.
 */

export const RETURN_WINDOW_DAYS = 14

/** A parcel nobody marked delivered is taken as arrived this long after it left. */
export const UNMARKED_ARRIVAL_DAYS = 30

const DAY = 24 * 60 * 60 * 1000

export interface ReturnOrderFacts {
  items?:
    | ({
        id: string
        detail?: {
          shipped_quantity?: number | null
          return_requested_quantity?: number | null
          return_received_quantity?: number | null
          return_dismissed_quantity?: number | null
        } | null
      } | null)[]
    | null
  fulfillments?:
    | ({
        shipped_at?: string | Date | null
        delivered_at?: string | Date | null
        canceled_at?: unknown
      } | null)[]
    | null
}

export interface ReturnLine {
  line_item_id: string
  quantity: number
}

/** The order fields `returnable` and `windowOpen` read. */
export const RETURN_ORDER_FIELDS = [
  "items.id",
  "items.detail.shipped_quantity",
  "items.detail.return_requested_quantity",
  "items.detail.return_received_quantity",
  "items.detail.return_dismissed_quantity",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
]

/**
 * A request's lines as they count: what came back, sound and damaged, once
 * received; what it asked for until then.
 */
export function cameBack(request: {
  items: unknown
  received_items?: unknown
  damaged_items?: unknown
}): ReturnLine[] {
  if (!request.received_items && !request.damaged_items) {
    return request.items as ReturnLine[]
  }
  const total = new Map<string, number>()
  for (const line of [
    ...((request.received_items ?? []) as ReturnLine[]),
    ...((request.damaged_items ?? []) as ReturnLine[]),
  ]) {
    total.set(line.line_item_id, (total.get(line.line_item_id) ?? 0) + line.quantity)
  }
  return [...total].map(([line_item_id, quantity]) => ({ line_item_id, quantity }))
}

/**
 * Each line's quantity still returnable, by line id; `kept` are units
 * already refunded without coming back (the refund window).
 */
export function returnable(
  order: ReturnOrderFacts,
  asked: readonly ReturnLine[],
  kept: ReadonlyMap<string, number> = new Map()
): Map<string, number> {
  const taken = new Map<string, number>()
  for (const line of asked) {
    taken.set(line.line_item_id, (taken.get(line.line_item_id) ?? 0) + line.quantity)
  }
  const left = new Map<string, number>()
  for (const item of order.items ?? []) {
    if (!item) {
      continue
    }
    const detail = item.detail
    // Our approved requests open Medusa's returns too: the larger count, not both
    const inMedusa =
      (detail?.return_requested_quantity ?? 0) +
      (detail?.return_received_quantity ?? 0) +
      (detail?.return_dismissed_quantity ?? 0)
    const quantity =
      (detail?.shipped_quantity ?? 0) -
      Math.max(taken.get(item.id) ?? 0, inMedusa) -
      (kept.get(item.id) ?? 0)
    if (quantity > 0) {
      left.set(item.id, quantity)
    }
  }
  return left
}

/** Whether a return can still be asked for: something shipped, and within the window once arrived. */
export function windowOpen(order: ReturnOrderFacts, now: Date): boolean {
  const live = (order.fulfillments ?? []).filter(
    (fulfillment): fulfillment is NonNullable<typeof fulfillment> =>
      Boolean(fulfillment?.shipped_at) && !fulfillment?.canceled_at
  )
  if (live.length === 0) {
    return false
  }
  // From the last parcel to arrive; one on its way keeps it open, but not for ever
  const last = Math.max(
    ...live.map((fulfillment) =>
      fulfillment.delivered_at
        ? new Date(fulfillment.delivered_at).getTime()
        : new Date(fulfillment.shipped_at ?? 0).getTime() + UNMARKED_ARRIVAL_DAYS * DAY
    )
  )
  return now.getTime() - last <= RETURN_WINDOW_DAYS * DAY
}

/** Why the lines cannot be asked for (an i18n key); null when they can. */
export function linesProblem(
  left: ReadonlyMap<string, number>,
  wanted: readonly ReturnLine[]
): string | null {
  const ids = new Set(wanted.map((line) => line.line_item_id))
  if (wanted.length === 0 || ids.size !== wanted.length) {
    return "returns.items_invalid"
  }
  return wanted.some(
    (line) => line.quantity < 1 || line.quantity > (left.get(line.line_item_id) ?? 0)
  )
    ? "returns.items_invalid"
    : null
}
