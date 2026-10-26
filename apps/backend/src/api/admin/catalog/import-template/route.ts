import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { XLSX_MIME, writeXlsx } from "../../../../lib/sheets"
import { sheetContext } from "../../../../workflows/catalog/export/context"
import { HELP_ROWS, HELP_WIDTHS } from "../../../../workflows/catalog/export/help"
import { sheetHeader, sheetWidths } from "../../../../workflows/catalog/export/rows"

/**
 * `GET /admin/catalog/import-template` (F3.9): an empty product sheet with
 * the shop's columns (its units, its templates' attributes) and a sheet on
 * what each takes. An export is a filled one.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const context = await sheetContext(req.scope)
  res.setHeader("Content-Type", XLSX_MIME)
  res.setHeader("Content-Disposition", 'attachment; filename="urun-sablonu.xlsx"')
  res.setHeader("Cache-Control", "no-store")
  const stream = writeXlsx([
    {
      name: "Ürünler",
      widths: sheetWidths(context.attributeKeys),
      rows: [sheetHeader(context.units, context.attributeKeys)],
    },
    { name: "Nasıl doldurulur", widths: HELP_WIDTHS, rows: HELP_ROWS },
  ])
  for await (const chunk of stream) {
    res.write(chunk as Buffer)
  }
  res.end()
}
