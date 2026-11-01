import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { previewEntryOf } from "../../../../../lib/content/preview-token"
import { orderAccessKey } from "../../../../../lib/orders/access-token"
import { storeContentEntry } from "../../read"

/**
 * GET /store/content/preview/:token (F18): a draft as its page will read,
 * for the storefront's preview page; only with a link staff made in the
 * last day (`POST /admin/content/:id/preview`). Never cached.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  const id = previewEntryOf(orderAccessKey(), req.params["token"] ?? "")
  if (!id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.unknown")
  }
  res.json({ entry: await storeContentEntry(req.scope, id, { draft: true }) })
}
