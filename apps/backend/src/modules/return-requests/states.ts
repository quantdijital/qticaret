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

/** Money back for what came back, or another variant of it (adr/0032 §6). */
export const RETURN_KINDS = ["return", "exchange"] as const
export type ReturnKind = (typeof RETURN_KINDS)[number]

export const RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded",
  "canceled",
] as const
export type ReturnStatus = (typeof RETURN_STATUSES)[number]

/**
 * Why a request was cancelled: staff withdrew an approval before anything
 * came back (the shopper gave up, or it was a mistake), or the order's
 * cancel closed a request still waiting (a gift card line's, adr/0025).
 */
export const RETURN_CANCEL_CAUSES = ["staff", "order_canceled"] as const
export type ReturnCancelCause = (typeof RETURN_CANCEL_CAUSES)[number]

/** Still being dealt with: an order has at most one request in these. */
export const OPEN_RETURN_STATUSES = ["requested", "approved"] as const

/** Requests whose lines count against what can still be returned. */
export const COUNTED_RETURN_STATUSES = ["requested", "approved", "received", "refunded"] as const
