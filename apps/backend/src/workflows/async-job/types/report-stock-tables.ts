import type { SheetCell } from "../../../lib/sheets"
import type { stockView } from "../../../api/admin/reports/stock/read"
import { lira } from "./report-tables"

/** The stock report's tables as a file has them (F11.4): every stock item, not a page. */

export const STOCK_TABLES = ["stock", "idle", "uncosted"] as const
export type StockTable = (typeof STOCK_TABLES)[number]

type Row = ReturnType<typeof stockView>

const money = (amount: string | null): SheetCell => (amount === null ? null : lira(amount))

const names = (row: Row): SheetCell[] => [
  row.product_title ?? "",
  row.variant_title ?? "",
  row.sku ?? "",
]

export function stockTables(rows: readonly Row[]): Record<StockTable, SheetCell[][]> {
  const shelved = rows.filter((row) => row.on_hand > 0)
  return {
    stock: [
      [
        "Ürün",
        "Varyant",
        "SKU",
        "Eldeki adet",
        "Birim maliyet (TL)",
        "Stok değeri (TL)",
        "Satılan",
        "Dönem başı",
        "Dönem sonu",
        "Devir hızı",
        "Hareketsiz",
      ],
      ...rows.map((row) => [
        ...names(row),
        row.on_hand,
        money(row.cost),
        money(row.value),
        row.sold,
        row.start,
        row.end,
        row.turnover,
        row.idle ? "Evet" : "Hayır",
      ]),
    ],
    idle: [
      ["Ürün", "Varyant", "SKU", "Eldeki adet", "Birim maliyet (TL)", "Stok değeri (TL)"],
      ...shelved
        .filter((row) => row.idle)
        .map((row) => [...names(row), row.on_hand, money(row.cost), money(row.value)]),
    ],
    uncosted: [
      ["Ürün", "Varyant", "SKU", "Eldeki adet"],
      ...shelved.filter((row) => row.cost === null).map((row) => [...names(row), row.on_hand]),
    ],
  }
}

export const STOCK_SHEETS: Record<StockTable, { name: string; widths: number[] }> = {
  stock: { name: "Stok", widths: [36, 18, 16, 12, 16, 16, 10, 12, 12, 10, 12] },
  idle: { name: "Hareketsiz stok", widths: [36, 18, 16, 12, 16, 16] },
  uncosted: { name: "Maliyeti girilmemiş", widths: [36, 18, 16, 12] },
}
