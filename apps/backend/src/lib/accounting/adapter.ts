import type { Party } from "./package"

/**
 * An accounting program the shop's records go to (F11.5, adr/0039 §5;
 * docs/entegrasyonlar/muhasebe.md). Every push carries our record's id as
 * `reference`: an adapter must treat a second push with the same
 * reference as the same record (look it up first, or send it as the
 * program's own idempotency key), so a retry never makes a duplicate.
 * The first real adapter (Paraşüt, Logo, Mikro) comes when a shop picks
 * its program.
 */

export interface AccountingRef {
  /** The record's id in the program. */
  external_id: string
}

/** A VAT rate's line of a sale, in lira (two decimals as text). */
export interface SaleLine {
  rate: number
  base: string
  tax: string
  gross: string
}

export interface CustomerInput {
  reference: string
  party: Extract<Party, { kind: "corporate" }>
}

export interface SaleInput {
  reference: string
  order_display_id: number
  day: string
  /** The program's customer for a corporate sale; null for an individual (a retail sale). */
  customer: AccountingRef | null
  lines: SaleLine[]
  total: string
}

export interface MoneyInput {
  reference: string
  order_display_id: number | null
  day: string
  /** `paytr`, `iyzico`, `bank-transfer`, … */
  method: string
  amount: string
}

export interface AccountingAdapter {
  readonly id: string
  upsertCustomer(input: CustomerInput): Promise<AccountingRef>
  pushSale(input: SaleInput): Promise<AccountingRef>
  pushPayment(input: MoneyInput): Promise<AccountingRef>
  pushReturn(input: MoneyInput): Promise<AccountingRef>
  healthCheck(): Promise<"ok" | "down">
}
