import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PREVIEW_PATH, previewToken } from "../../../../../lib/content/preview-token"
import { orderAccessKey } from "../../../../../lib/orders/access-token"
import { CONTENT_MODULE } from "../../../../../modules/content"
import type ContentModuleService from "../../../../../modules/content/service"
import { brandOf } from "../../../../../workflows/messaging/brand"

/**
 * POST /admin/content/:id/preview (F18): a link that shows the entry, draft
 * or not, on the storefront for a day and until it is saved again; the
 * address is the shop's own once its canonical host is set, else the path.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  const [entry] = await req.scope
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentEntries({ id }, { select: ["id", "updated_at"], take: 1 })
  if (!entry) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.unknown")
  }
  const { token, expires_at } = previewToken(orderAccessKey(), entry)
  const { storefrontUrl } = await brandOf(req.scope)
  const path = `${PREVIEW_PATH}/${token}`
  res.json({ url: storefrontUrl ? `${storefrontUrl}${path}` : path, path, expires_at })
}
