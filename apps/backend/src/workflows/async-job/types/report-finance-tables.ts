import { turkishDay } from "../../../lib/dashboard"
import type { SheetCell } from "../../../lib/sheets"
import type { FinanceReport } from "../../../api/admin/reports/finance/read"
import { lira } from "./report-tables"

/** The finance report's tables as a file has them (F11.3). */

export const FINANCE_TABLES = ["vat", "payments", "chargebacks"] as const
export type FinanceTable = (typeof FINANCE_TABLES)[number]

const METHODS: Record<string, string> = {
  paytr: "PayTR",
  iyzico: "iyzico",
  "bank-transfer": "Havale/EFT",
  cod: "Kapıda ödeme",
  "gift-card": "Hediye kartı",
  system: "Sistem (deneme)",
}

const REASONS: Record<string, string> = {
  not_received: "Ürün ulaşmadı",
  unauthorized: "İzinsiz işlem",
  not_as_described: "Tanıma uymuyor",
  duplicate: "Mükerrer çekim",
  other: "Diğer",
}

const STATUSES: Record<string, string> = {
  open: "Açık",
  evidence_submitted: "Belge sunuldu",
  won: "Kazanıldı",
  lost: "Kaybedildi",
}

export function financeTables(report: FinanceReport): Record<FinanceTable, SheetCell[][]> {
  return {
    vat: [
      ["KDV oranı (%)", "Matrah (TL)", "KDV (TL)", "Toplam (TL)"],
      ...report.vat.map((row) => [row.rate, lira(row.base), lira(row.tax), lira(row.gross)]),
    ],
    payments: [
      ["Ödeme yöntemi", "Ödeme", "Tahsil edilen (TL)", "İade edilen (TL)", "Net (TL)"],
      ...report.payments.map((row) => [
        METHODS[row.method] ?? row.method,
        row.payments,
        lira(row.captured),
        lira(row.refunded),
        lira(row.net),
      ]),
    ],
    chargebacks: [
      ["Sipariş", "Sağlayıcı", "Sebep", "Durum", "Tutar (TL)", "Açılış", "Son gün"],
      ...report.chargebacks.map((row) => [
        row.order_display_id === null ? "" : `#${String(row.order_display_id)}`,
        row.provider,
        REASONS[row.reason] ?? row.reason,
        STATUSES[row.status] ?? row.status,
        lira(row.amount),
        turkishDay(new Date(row.opened_at)),
        row.due_at ? turkishDay(new Date(row.due_at)) : "",
      ]),
    ],
  }
}

export const FINANCE_SHEETS: Record<FinanceTable, { name: string; widths: number[] }> = {
  vat: { name: "KDV dökümü", widths: [14, 16, 14, 16] },
  payments: { name: "Tahsilat", widths: [20, 10, 18, 18, 14] },
  chargebacks: { name: "Ters ibrazlar", widths: [12, 14, 20, 16, 12, 12, 12] },
}
