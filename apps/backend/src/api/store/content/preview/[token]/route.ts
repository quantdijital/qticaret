import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { previewOpens, previewTokenParts } from "../../../../../lib/content/preview-token"
import { orderAccessKey } from "../../../../../lib/orders/access-token"
import { CONTENT_MODULE } from "../../../../../modules/content"
import type ContentModuleService from "../../../../../modules/content/service"
import { storeContentEntry } from "../../read"

/**
 * GET /store/content/preview/:token (F18): a draft as its page will read,
 * for the storefront's preview page; only with a link staff made in the
 * last day, and only while the entry is as it was then. Never cached.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  const parts = previewTokenParts(req.params["token"] ?? "")
  const [entry] = parts
    ? await req.scope
        .resolve<ContentModuleService>(CONTENT_MODULE)
        .listContentEntries({ id: parts.entryId }, { select: ["id", "updated_at"], take: 1 })
    : []
  if (!parts || !entry || !previewOpens(orderAccessKey(), parts, entry.updated_at)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.unknown")
  }
  res.json({ entry: await storeContentEntry(req.scope, entry.id, { draft: true }) })
}
