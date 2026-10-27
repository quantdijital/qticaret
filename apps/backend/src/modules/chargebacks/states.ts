/** Why the cardholder disputes the payment (adr/0030). */
export const CHARGEBACK_REASONS = [
  "not_received",
  "unauthorized",
  "not_as_described",
  "duplicate",
  "other",
] as const
export type ChargebackReason = (typeof CHARGEBACK_REASONS)[number]

export const CHARGEBACK_STATUSES = ["open", "evidence_submitted", "won", "lost"] as const
export type ChargebackStatus = (typeof CHARGEBACK_STATUSES)[number]

/** Still being argued: a payment has at most one dispute in these. */
export const OPEN_STATUSES = ["open", "evidence_submitted"] as const

/** Where a dispute may go from each state (adr/0030); a closed one goes nowhere. */
export const NEXT_STATUS: Readonly<Record<ChargebackStatus, readonly ChargebackStatus[]>> = {
  open: ["evidence_submitted", "won", "lost"],
  evidence_submitted: ["won", "lost"],
  won: [],
  lost: [],
}

export const isClosed = (status: ChargebackStatus): boolean => NEXT_STATUS[status].length === 0
