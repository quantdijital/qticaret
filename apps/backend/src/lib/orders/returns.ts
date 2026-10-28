/**
 * What a shopper may still send back (F7.9, adr/0032): of each line, what
 * was shipped, less what earlier requests already asked for; and for how
 * long: 14 days after the last parcel arrived (the distance-sale
 * withdrawal period; the shop's own terms come with F13). A parcel still
 * on its way can be asked about already. Pure, so tested on its own.
 */

export const RETURN_WINDOW_DAYS = 14

const DAY = 24 * 60 * 60 * 1000

export interface ReturnOrderFacts {
  items?: ({ id: string; detail?: { shipped_quantity?: number | null } | null } | null)[] | null
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

/** Each line's quantity still returnable, by line id. */
export function returnable(
  order: ReturnOrderFacts,
  asked: readonly ReturnLine[]
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
    const quantity = (item.detail?.shipped_quantity ?? 0) - (taken.get(item.id) ?? 0)
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
  // A parcel not yet arrived keeps it open; otherwise from the last one that did
  if (live.some((fulfillment) => !fulfillment.delivered_at)) {
    return true
  }
  const last = Math.max(
    ...live.map((fulfillment) => new Date(fulfillment.delivered_at ?? 0).getTime())
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
