import { randomUUID } from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { CSV_BOM, toCsv } from "../../../lib/security"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import type { SheetCell } from "../../../lib/sheets"
import { sheetContext } from "../../catalog/export/context"
import { HELP_ROWS, HELP_WIDTHS } from "../../catalog/export/help"
import { EXPORT_FIELDS, productRows, sheetHeader, sheetWidths } from "../../catalog/export/rows"
import type { ExportProductRow, VatNames } from "../../catalog/export/rows"
import type { JobContext, JobType } from "./types"

const PAGE = 100
// A bigger catalog is cut here and says so in its summary
export const MAX_EXPORT_ROWS = 50_000

const input = z.object({ format: z.enum(["xlsx", "csv"]).default("xlsx") }).strict()

async function* sheetRows(
  { container, progress }: Pick<JobContext, "container" | "progress">,
  header: string[],
  attributeKeys: readonly string[],
  locationId: string | null,
  totals: { products: number; rows: number; cut: boolean },
  vatNames?: VatNames
): AsyncGenerator<SheetCell[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  yield header
  for (let skip = 0; ; skip += PAGE) {
    const { data, metadata } = await query.graph({
      entity: "product",
      fields: EXPORT_FIELDS,
      pagination: { skip, take: PAGE, order: { created_at: "ASC", id: "ASC" } },
    })
    for (const product of data as ExportProductRow[]) {
      const rows = productRows(product, attributeKeys, locationId, vatNames)
      if (totals.rows + rows.length > MAX_EXPORT_ROWS) {
        totals.cut = true
        return
      }
      totals.products += 1
      totals.rows += rows.length
      yield* rows
    }
    const count = metadata?.count ?? 0
    await progress(Math.min(99, Math.floor(((skip + data.length) / Math.max(count, 1)) * 100)))
    if (data.length < PAGE) {
      return
    }
  }
}

/**
 * The catalog as a product sheet (F3.9, adr/0018): the import's columns,
 * one row per variant, an xlsx with a sheet on what each column takes, or
 * a `;` CSV with a BOM for Turkish Excel. Every text cell is escaped
 * against formulas (KK). Written as it is read: no catalog sits whole in
 * memory.
 */
export const catalogExport: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, progress, resultFile }, { format }) => {
    const context = await sheetContext(container)
    const header = sheetHeader(context.units, context.attributeKeys)
    const totals = { products: 0, rows: 0, cut: false }
    const rows = sheetRows(
      { container, progress },
      header,
      context.attributeKeys,
      context.locationId,
      totals,
      context.vatNames
    )
    const file = await resultFile(
      `katalog-${randomUUID()}.${format}`,
      format === "xlsx" ? XLSX_MIME : "text/csv"
    )
    if (format === "xlsx") {
      for await (const chunk of writeXlsx([
        { name: "Ürünler", widths: sheetWidths(context.attributeKeys), rows },
        { name: "Nasıl doldurulur", widths: HELP_WIDTHS, rows: HELP_ROWS },
      ])) {
        await file.write(chunk as Buffer)
      }
    } else {
      await file.write(CSV_BOM)
      for await (const row of rows) {
        // Turkish Excel reads `1.5` as a date: numbers go out with a decimal comma, as the import reads them
        await file.write(toCsv([row], ";", { decimalComma: true }))
      }
    }
    return { summary: { format, ...totals } }
  },
}
