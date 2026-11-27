import { once } from "node:events"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ConflictError } from "../../../../../lib/errors"
import { errorSummary, logger } from "../../../../../lib/logging"
import { writeUrlExport } from "../../../../../workflows/migration/urls-export"

// The people exporting now, in this process: one export each at a time
const exporting = new Set<string>()

/**
 * `GET /admin/migrations/urls/export` (adr/0042 Ek 2026-11-27): the old
 * site's addresses and where each goes now, as CSV ("Yönlendirme listesini
 * indir"), at most `URL_EXPORT_CAP` rows. The owner's alone, as every
 * migration route; one at a time per person (409 `migration.export_busy`).
 * A client gone stops the walk; a slow one is waited for. A failure after
 * the first bytes cannot become an error answer: it is logged and the
 * connection is cut, so no half file passes for a whole one.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const actor = req.auth_context.actor_id || "unknown"
  if (exporting.has(actor)) {
    throw new ConflictError("migration.export_busy")
  }
  exporting.add(actor)
  const gone = new AbortController()
  const onClose = () => {
    gone.abort()
  }
  res.once("close", onClose)
  try {
    res.setHeader("content-type", "text/csv; charset=utf-8")
    res.setHeader("content-disposition", 'attachment; filename="yonlendirmeler.csv"')
    res.setHeader("cache-control", "no-store")
    const { cut } = await writeUrlExport(
      req.scope,
      async (chunk) => {
        if (!res.write(chunk) && !gone.signal.aborted) {
          // Waits for the buffer to drain; the listener goes with the signal
          await once(res, "drain", { signal: gone.signal }).catch(() => undefined)
        }
      },
      () => gone.signal.aborted
    )
    if (cut) {
      logger.info({ event: "migration.url_export_cut" })
    }
    res.end()
  } catch (error) {
    logger.warn({ event: "migration.url_export_failed", err: errorSummary(error) })
    if (!res.headersSent) {
      throw error
    }
    res.destroy()
  } finally {
    res.off("close", onClose)
    exporting.delete(actor)
  }
}
