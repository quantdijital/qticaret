import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { writeUrlExport } from "../../../../../workflows/migration/urls-export"

/**
 * `GET /admin/migrations/urls/export` (adr/0042 Ek 2026-11-27): the old
 * site's addresses and where each goes now, as CSV ("Yönlendirme listesini
 * indir"). The owner's alone, as every migration route; the old site's
 * paths only, no person's data.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("content-type", "text/csv; charset=utf-8")
  res.setHeader("content-disposition", 'attachment; filename="yonlendirmeler.csv"')
  res.setHeader("cache-control", "no-store")
  // A client gone stops the walk; a slow one is waited for (its buffer drained)
  let gone = false
  req.on("close", () => {
    gone = true
  })
  await writeUrlExport(
    req.scope,
    async (chunk) => {
      if (!res.write(chunk) && !gone) {
        await new Promise<void>((resolve) => {
          res.once("drain", resolve)
          res.once("close", resolve)
        })
      }
    },
    () => gone
  )
  res.end()
}
