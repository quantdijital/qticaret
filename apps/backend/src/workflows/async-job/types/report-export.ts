import { randomUUID } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { turkishDay } from "../../../lib/dashboard"
import { CSV_BOM, toCsv } from "../../../lib/security"
import { toSlug } from "../../../lib/seo"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import type { SheetCell, SheetSpec } from "../../../lib/sheets"
import { computeSalesReport, windowOf } from "../../../api/admin/dashboard/overview/read"
import { computeFinanceReport } from "../../../api/admin/reports/finance/read"
import { REPORT_RANGE_FIELDS, checkRange, rangeOf } from "../../../api/admin/reports/validators"
import { FINANCE_SHEETS, FINANCE_TABLES, financeTables } from "./report-finance-tables"
import { SALES_SHEETS, SALES_TABLES, salesTables } from "./report-tables"
import type { JobType } from "./types"

const input = z
  .object({
    ...REPORT_RANGE_FIELDS,
    report: z.enum(["sales", "finance"]).default("sales"),
    format: z.enum(["xlsx", "csv"]).default("xlsx"),
    // A CSV holds one of the report's tables; an xlsx has them all, a sheet each
    table: z.enum([...SALES_TABLES, ...FINANCE_TABLES]).optional(),
  })
  .strict()
  .superRefine(checkRange)
  .superRefine((query, ctx) => {
    const own: readonly string[] = query.report === "finance" ? FINANCE_TABLES : SALES_TABLES
    if (query.table && !own.includes(query.table)) {
      ctx.addIssue({ code: "custom", path: ["table"], message: "async_job.input_invalid" })
    }
  })

interface Built {
  name: string
  tables: Record<string, SheetCell[][]>
  sheets: Record<string, { name: string; widths: number[] }>
  first: string
  summary: Record<string, unknown>
}

/**
 * A report as a file (F11.1, F11.3, adr/0039): the same numbers as the
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
    let built: Built
    if (query.report === "finance") {
      const report = await computeFinanceReport(container, window)
      built = {
        name: "finans-raporu",
        tables: financeTables(report),
        sheets: FINANCE_SHEETS,
        first: "vat",
        summary: { capped: report.capped },
      }
    } else {
      const report = await computeSalesReport(container, window)
      built = {
        name: "satis-raporu",
        tables: salesTables(report),
        sheets: SALES_SHEETS,
        first: "daily",
        summary: { orders: report.totals.orders.current, capped: report.capped },
      }
    }
    const table = query.table ?? built.first
    // A CSV is one table: its name says which (`satis-raporu-gunluk-…`)
    const name =
      query.format === "csv"
        ? `${built.name}-${toSlug(built.sheets[table]?.name ?? table)}`
        : built.name
    const stamp = `${turkishDay(window.from)}_${turkishDay(new Date(window.to.getTime() - 1))}`
    const file = await resultFile(
      `${name}-${stamp}-${randomUUID().slice(0, 8)}.${query.format}`,
      query.format === "xlsx" ? XLSX_MIME : "text/csv"
    )
    if (query.format === "xlsx") {
      const sheets: SheetSpec[] = Object.keys(built.tables).map((table) => ({
        name: built.sheets[table]?.name ?? table,
        widths: built.sheets[table]?.widths ?? [],
        rows: built.tables[table] ?? [],
      }))
      for await (const chunk of writeXlsx(sheets)) {
        await file.write(chunk as Buffer)
      }
    } else {
      await file.write(CSV_BOM)
      // Turkish Excel reads `1.5` as a date: numbers go out with a decimal comma
      const rows = (built.tables[table] ?? []).map((row) =>
        row.map((cell) => (typeof cell === "number" ? String(cell).replace(".", ",") : cell))
      )
      await file.write(toCsv(rows, ";"))
    }
    await progress(100)
    return {
      summary: {
        report: query.report,
        format: query.format,
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        ...built.summary,
      },
    }
  },
}
