import type { BigNumberInput } from "@medusajs/framework/types"
import { BANK_TRANSFER_PAYMENT_PROVIDER_ID } from "./checkout"

const HOUR = 60 * 60 * 1000

/** The most hours a shop can give to pay (the `bank_transfer` section's limit). */
export const MAX_DEADLINE_HOURS = 336

/** What an order's bank transfer is read from (adr/0029). */
export const BANK_TRANSFER_ORDER_FIELDS = [
  "status",
  "created_at",
  "payment_collections.status",
  "payment_collections.payment_sessions.id",
  "payment_collections.payment_sessions.provider_id",
  "payment_collections.payment_sessions.amount",
  "payment_collections.payment_sessions.currency_code",
  "payment_collections.payment_sessions.data",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
]

export interface BankTransferSessionRow {
  id: string
  provider_id: string
  amount: BigNumberInput
  currency_code: string
  data?: Record<string, unknown> | null
}

export interface BankTransferOrderRow {
  status?: string
  created_at?: string | Date
  payment_collections?:
    | ({
        status?: string | null
        payment_sessions?: (BankTransferSessionRow | null)[] | null
        payments?: ({ captured_at?: unknown; canceled_at?: unknown } | null)[] | null
      } | null)[]
    | null
}

/** The order's bank transfer: its session and the collection it belongs to; null when paid another way. */
export function bankTransferOf(order: BankTransferOrderRow) {
  for (const collection of order.payment_collections ?? []) {
    const session = collection?.payment_sessions?.find(
      (each) => each?.provider_id === BANK_TRANSFER_PAYMENT_PROVIDER_ID
    )
    if (collection && session) {
      const captured = (collection.payments ?? []).some(
        (payment) => payment?.captured_at && !payment.canceled_at
      )
      return { collection, session, captured }
    }
  }
  return null
}

/** When the shop said the money came; null until then. */
export const confirmedAt = (session: Pick<BankTransferSessionRow, "data">): string | null => {
  const at = session.data?.["confirmed_at"]
  return typeof at === "string" ? at : null
}

/** When the time to pay runs out: the session's own hours, as the shopper was told. */
export function transferDeadline(
  createdAt: string | Date | undefined,
  session: Pick<BankTransferSessionRow, "data">
): Date | null {
  const hours = session.data?.["deadline_hours"]
  return typeof hours === "number" && createdAt
    ? new Date(new Date(createdAt).getTime() + hours * HOUR)
    : null
}

/** The lock the confirmation, the expiry and the panel's cancel share for one order. */
export const bankTransferLockKey = (orderId: string): string => `orders:bank-transfer:${orderId}`
