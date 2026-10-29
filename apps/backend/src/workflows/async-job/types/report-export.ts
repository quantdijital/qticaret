import { randomUUID } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { turkishDay } from "../../../lib/dashboard"
import { fromMedusaAmount } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { CSV_BOM, toCsv } from "../../../lib/security"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import type { SheetCell, SheetSpec } from "../../../lib/sheets"
import {
  MAX_REPORT_ORDERS,
  REPORT_LIMITS,
  computeOverview,
  windowOf,
} from "../../../api/admin/dashboard/overview/read"
import type { DashboardOverview } from "../../../api/admin/dashboard/overview/read"
import { REPORT_RANGE_FIELDS, checkRange, rangeOf } from "../../../api/admin/reports/validators"
import type { JobType } from "./types"

const TABLES = ["summary", "daily", "products", "categories"] as const
type Table = (typeof TABLES)[number]

const input = z
  .object({
    ...REPORT_RANGE_FIELDS,
    format: z.enum(["xlsx", "csv"]).default("xlsx"),
    // A CSV holds one table; an xlsx has them all, a sheet each
    table: z.enum(TABLES).default("daily"),
  })
  .strict()
  .superRefine(checkRange)

// Lira as a number a spreadsheet sums: 1234.5, never "₺1.234,50"
const lira = (amount: MedusaAmount): number =>
  fromMedusaAmount(amount, { allowRounding: true }) / 100

const bucketName = (bucket: string, hourly: boolean): string => {
  const at = new Date(bucket)
  return hourly
    ? `${turkishDay(at)} ${String((at.getUTCHours() + 3) % 24).padStart(2, "0")}:00`
    : turkishDay(at)
}

const round = (value: number, digits: number) => {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

/** Each table's rows, header first, with the panel's report's columns. */
function tables(report: DashboardOverview): Record<Table, SheetCell[][]> {
  const hourly = report.period.granularity === "hour"
  const { totals } = report
  const total = lira(totals.sales.current)
  const share = (sales: number) => (total > 0 ? round((sales / total) * 100, 1) : 0)
  return {
    summary: [
      ["Ölçü", "Dönem", "Önceki dönem"],
      ["Başlangıç", turkishDay(new Date(report.period.from)), null],
      ["Bitiş", turkishDay(new Date(new Date(report.period.to).getTime() - 1)), null],
      ["Ciro (TL)", lira(totals.sales.current), lira(totals.sales.previous)],
      ["Sipariş", totals.orders.current, totals.orders.previous],
      [
        "Ortalama sepet (TL)",
        lira(totals.average_order.current),
        lira(totals.average_order.previous),
      ],
      ["Satılan adet", totals.units.current, totals.units.previous],
    ],
    daily: [
      [
        hourly ? "Saat" : "Gün",
        "Sipariş",
        "Adet",
        "Ciro (TL)",
        "Ortalama sepet (TL)",
        "Önceki dönem ciro (TL)",
      ],
      ...report.series.map((row) => [
        bucketName(row.bucket, hourly),
        row.orders,
        row.units,
        lira(row.sales),
        row.orders > 0 ? round(lira(row.sales) / row.orders, 2) : 0,
        lira(row.previous_sales),
      ]),
    ],
    products: [
      ["Sıra", "Ürün", "Adet", "Ortalama fiyat (TL)", "Pay (%)", "Ciro (TL)"],
      ...report.top_products.map((row, index) => {
        const sales = lira(row.sales)
        return [
          index + 1,
          row.title,
          row.units,
          row.units > 0 ? round(sales / row.units, 2) : 0,
          share(sales),
          sales,
        ]
      }),
    ],
    categories: [
      ["Kategori", "Pay (%)", "Ciro (TL)"],
      ...report.categories.map((row) => [
        row.kind === "category"
          ? (row.name ?? "")
          : row.kind === "uncategorized"
            ? "Kategorisiz"
            : "Diğer",
        share(lira(row.sales)),
        lira(row.sales),
      ]),
    ],
  }
}

const SHEETS: Record<Table, { name: string; widths: number[] }> = {
  summary: { name: "Özet", widths: [24, 16, 16] },
  daily: { name: "Günlük", widths: [18, 10, 10, 14, 20, 22] },
  products: { name: "Ürünler", widths: [8, 48, 10, 18, 10, 14] },
  categories: { name: "Kategoriler", widths: [32, 10, 14] },
}

/**
 * The sales report as a file (F11.1, adr/0039): the same numbers as the
 * panel's, over the same days; an xlsx with a sheet per table, or one
 * table as CSV (`;`, BOM, decimal comma for Turkish Excel). Every text
 * cell is escaped against formulas (docs/04); no personal data.
 */
export const reportExport: JobType<z.infer<typeof input>> = {
  input,
  singleton: false,
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, progress, resultFile }, query) => {
    const window = windowOf(rangeOf(query))
    await progress(10)
    const report = await computeOverview(container, window, REPORT_LIMITS, MAX_REPORT_ORDERS)
    const all = tables(report)
    const stamp = `${turkishDay(window.from)}_${turkishDay(new Date(window.to.getTime() - 1))}`
    const file = await resultFile(
      `satis-raporu-${stamp}-${randomUUID().slice(0, 8)}.${query.format}`,
      query.format === "xlsx" ? XLSX_MIME : "text/csv"
    )
    if (query.format === "xlsx") {
      const sheets: SheetSpec[] = TABLES.map((table) => ({ ...SHEETS[table], rows: all[table] }))
      for await (const chunk of writeXlsx(sheets)) {
        await file.write(chunk as Buffer)
      }
    } else {
      await file.write(CSV_BOM)
      // Turkish Excel reads `1.5` as a date: numbers go out with a decimal comma
      const rows = all[query.table].map((row) =>
        row.map((cell) => (typeof cell === "number" ? String(cell).replace(".", ",") : cell))
      )
      await file.write(toCsv(rows, ";"))
    }
    await progress(100)
    return {
      summary: {
        format: query.format,
        from: report.period.from,
        to: report.period.to,
        orders: report.totals.orders.current,
        capped: report.capped,
      },
    }
  },
}
