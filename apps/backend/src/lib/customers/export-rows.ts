import { fromMedusaAmount } from "../money"
import { turkishDateTime } from "../orders/export-rows"
import type { SheetCell } from "../sheets"
import type { CustomerTotals } from "./totals"

/**
 * The customer list as a file (CU2, the owner's export): one row per
 * customer with what the list shows and nothing more (adr/0011): name,
 * company, e-mail, member or guest, when they joined, and the numbers of
 * `totals.ts` (orders, spent, average basket, last order, city). No phone,
 * address or tax id. Amounts are lira as numbers, times Turkey's.
 */

export interface ExportCustomer {
  id: string
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  email?: string | null
  has_account?: boolean | null
  created_at: string | Date
}

export const CUSTOMER_EXPORT_HEADER: readonly string[] = [
  "Ad Soyad",
  "Firma",
  "E-posta",
  "Tür",
  "Kayıt tarihi",
  "Sipariş sayısı",
  "Toplam harcama (₺)",
  "Ortalama sepet (₺)",
  "Son sipariş",
  "Şehir",
]

export const CUSTOMER_EXPORT_WIDTHS: readonly number[] = [24, 20, 30, 8, 17, 10, 14, 14, 17, 14]

const text = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? ""
  return trimmed === "" ? null : trimmed
}

const lira = (amount: string): number => fromMedusaAmount(amount, { allowRounding: true }) / 100

/** A customer's row; one without totals (none read) shows zero orders. */
export function customerExportRow(
  customer: ExportCustomer,
  totals: CustomerTotals | undefined
): SheetCell[] {
  const name = [text(customer.first_name), text(customer.last_name)].filter(Boolean).join(" ")
  return [
    name === "" ? null : name,
    text(customer.company_name),
    text(customer.email),
    customer.has_account ? "Üye" : "Misafir",
    turkishDateTime(customer.created_at),
    totals?.orders ?? 0,
    lira(totals?.spent ?? "0"),
    lira(totals?.average ?? "0"),
    totals?.last_order_at ? turkishDateTime(totals.last_order_at) : null,
    totals?.city ?? null,
  ]
}
