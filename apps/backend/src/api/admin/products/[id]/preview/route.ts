import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { PREVIEW_PATH, productPreview } from "../../../../../lib/content/preview-token"
import { orderAccessKey } from "../../../../../lib/orders/access-token"
import { productPath } from "../../../../../lib/seo"
import { PLATFORM_SETTINGS_MODULE } from "../../../../../modules/platform-settings"
import type { SeoSettings } from "../../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../../modules/platform-settings/service"
import { brandOf } from "../../../../../workflows/messaging/brand"

interface ProductRow {
  id: string
  handle: string
  status: string
  updated_at: string | Date
}

/**
 * POST /admin/products/:id/preview (F18): where the product's page is seen.
 * A published product's own address on the storefront (`live`); any other
 * a signed link to its page as last saved, for a day and until the next
 * save, never indexed (`/onizleme/<token>`, as a content draft's). The
 * address is the shop's own once its canonical host is set, else the path.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "handle", "status", "updated_at"],
    filters: { id: req.params["id"] ?? "" },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  const { storefrontUrl } = await brandOf(req.scope)
  const at = (path: string) => (storefrontUrl ? `${storefrontUrl}${path}` : path)
  if (product.status === "published") {
    const seo = (await req.scope
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("seo")) as unknown as SeoSettings
    const path = productPath(product.handle, seo.url_style.product)
    res.json({ live: true, url: at(path), path, expires_at: null })
    return
  }
  const { token, expires_at } = productPreview.token(orderAccessKey(), product)
  const path = `${PREVIEW_PATH}/${token}`
  res.json({ live: false, url: at(path), path, expires_at })
}
