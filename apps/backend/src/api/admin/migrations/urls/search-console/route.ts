import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isValidationError } from "../../../../../lib/errors"
import { importSearchConsole } from "../../../../../workflows/migration/old-site"
import { readRawBody } from "../../../../http/raw-body"
import { rejectRequest } from "../../../../http/reject"

// Search Console's export zip holds a few small CSVs
export const MAX_EXPORT_BYTES = 10 * 1024 * 1024

/**
 * `POST /admin/migrations/urls/search-console` (F14.7, KK3): Search
 * Console's performance export (its zip, or the pages CSV alone) as the
 * body; the old site's top pages join the inventory with their clicks.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  let bytes: Buffer
  try {
    bytes = await readRawBody(req, MAX_EXPORT_BYTES)
  } catch (error) {
    if (isValidationError(error)) {
      rejectRequest(
        req,
        res,
        413,
        { type: "invalid_data", message: error.safeMessage },
        "search_console_too_large"
      )
      return
    }
    throw error
  }
  res.json(await importSearchConsole(req.scope, bytes))
}
