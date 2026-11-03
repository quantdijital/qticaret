/**
 * What a shopper may still send back (F7.9, adr/0032): of each line, what
 * was shipped, less what earlier requests already asked for (or Medusa's
 * own returns hold, whichever is more); and for how long: the shop's
 * withdrawal period (14 days at least, F13.6) after the last parcel
 * arrived. A parcel still on its way can be asked about already; one never
 * marked delivered counts as arrived 30 days after it left. A line
 * outside the right of withdrawal comes back only as faulty or wrong.
 * Pure, so tested on its own.
 */

/** The law's withdrawal period, and the shop's until it sets its own (F13.6). */
export const RETURN_WINDOW_DAYS = 14

/**
 * Reasons that are the shop's fault (a faulty, wrong or misdescribed item):
 * these come back even for a product outside the right of withdrawal.
 */
export const DEFECT_REASONS: ReadonlySet<string> = new Set([
  "damaged",
  "wrong_item",
  "not_as_described",
])

/**
 * Why a line is outside the right of withdrawal: a digital or service
 * product marked so (F13.6; MSY md. 15/1-ğ, h: delivered or performed), an
 * add-on made to the buyer's wish (adr/0052 §8; md. 15/1-b), or a gift
 * card line whose cards were spent (adr/0025, 2026-11-03). A physical
 * product's mark is a warning, not an exclusion (`productMarkOf`).
 */
export const WITHDRAWAL_EXCLUSIONS = ["product", "personal_addon", "gift_card_used"] as const
export type WithdrawalExclusion = (typeof WITHDRAWAL_EXCLUSIONS)[number]

/** A parcel nobody marked delivered is taken as arrived this long after it left. */
export const UNMARKED_ARRIVAL_DAYS = 30

const DAY = 24 * 60 * 60 * 1000

export interface ReturnOrderFacts {
  items?:
    | ({
        id: string
        product_id?: string | null
        metadata?: Record<string, unknown> | null
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
  "items.product_id",
  // A line's add-on record can put it outside the right of withdrawal (adr/0052 §8)
  "items.metadata",
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
 * A request's lines as they count against what can still be asked: what
 * came back (`cameBack`), and what was refused at receipt (a hygiene good
 * opened, MSY md. 15/1-ç; never refunded, never asked again).
 */
export function counted(request: {
  items: unknown
  received_items?: unknown
  damaged_items?: unknown
  refused_items?: unknown
}): ReturnLine[] {
  const refused = ((request.refused_items ?? []) as ReturnLine[]).map(
    ({ line_item_id, quantity }) => ({ line_item_id, quantity })
  )
  return [...cameBack(request), ...refused]
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
export function windowOpen(
  order: ReturnOrderFacts,
  now: Date,
  days: number = RETURN_WINDOW_DAYS
): boolean {
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
  return now.getTime() - last <= days * DAY
}

/**
 * Why the lines cannot come back as a withdrawal (an i18n key); null when
 * they can: a product outside the right of withdrawal comes back only as
 * a faulty or wrong item, and is never exchanged.
 */
export function withdrawalProblem(
  wanted: readonly ReturnLine[],
  excluded: ReadonlySet<string>,
  request: { kind: "return" | "exchange"; reason: string }
): string | null {
  if (!wanted.some((line) => excluded.has(line.line_item_id))) {
    return null
  }
  return request.kind === "return" && DEFECT_REASONS.has(request.reason)
    ? null
    : "returns.withdrawal_excluded"
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
