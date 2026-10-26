import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CSV_BOM, toCsv } from "../../../../../../../lib/security"
import { batchCodes } from "../../../../../../../workflows/promotions/code-batch-reads"

/**
 * `GET /admin/promotions/:id/code-batches/:campaign_id/codes` (F4.6): a
 * batch's codes as a CSV, each with whether it was used; read from the
 * shop, so it is there long after the job's own file is gone.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const rows = await batchCodes(req.scope, req.params["id"] ?? "", req.params["campaign_id"] ?? "")
  const csv = toCsv(
    [["kod", "kullanıldı"], ...rows.map((row) => [row.code, row.used ? "evet" : "hayır"])],
    ";"
  )
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", 'attachment; filename="tek-kullanimlik-kodlar.csv"')
  res.setHeader("Cache-Control", "no-store")
  // Excel reads UTF-8 by its byte order mark ("hayır")
  res.send(`${CSV_BOM}${csv}`)
}
