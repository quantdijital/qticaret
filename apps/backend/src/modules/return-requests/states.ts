/** Why the shopper sends it back (adr/0032); worded in the storefront and the panel. */
export const RETURN_REASONS = [
  "damaged",
  "wrong_item",
  "not_as_described",
  "changed_mind",
  "size_issue",
  "other",
] as const
export type ReturnReason = (typeof RETURN_REASONS)[number]

export const RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded",
  "canceled",
] as const
export type ReturnStatus = (typeof RETURN_STATUSES)[number]

/** Still being dealt with: an order has at most one request in these. */
export const OPEN_RETURN_STATUSES = ["requested", "approved"] as const

/** Requests whose lines count against what can still be returned. */
export const COUNTED_RETURN_STATUSES = ["requested", "approved", "received", "refunded"] as const

/** Reasons the shop is answerable for: the parcel's shipping comes back too. */
export const SHOP_FAULT_REASONS: readonly ReturnReason[] = [
  "damaged",
  "wrong_item",
  "not_as_described",
]
