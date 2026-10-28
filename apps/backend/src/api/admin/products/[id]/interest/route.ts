import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BACK_IN_STOCK_MODULE } from "../../../../../modules/back-in-stock"
import type BackInStockModuleService from "../../../../../modules/back-in-stock/service"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"
import type WishlistModuleService from "../../../../../modules/wishlist/service"

/**
 * GET /admin/products/:id/interest (F10.4–F10.5): how many customers keep
 * the product, and how many wait for each variant to come back. Counts
 * only: who they are stays with them.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const productId = req.params["id"] ?? ""
  const [kept, waiting, { data }] = await Promise.all([
    req.scope
      .resolve<WishlistModuleService>(WISHLIST_MODULE)
      .listAndCountWishlistItems({ product_id: productId }, { take: 1, select: ["id"] }),
    req.scope
      .resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE)
      .listStockAlerts({ product_id: productId, status: "active" }, { select: ["variant_id"] }),
    req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product",
      fields: ["variants.id", "variants.title"],
      filters: { id: productId },
    }),
  ])
  const counts = new Map<string, number>()
  for (const { variant_id: id } of waiting) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const variants =
    (data[0] as { variants?: ({ id: string; title: string | null } | null)[] } | undefined)
      ?.variants ?? []
  res.json({
    wishlist: kept[1],
    stock_alerts: variants.flatMap((variant) =>
      variant && counts.has(variant.id)
        ? [{ variant_id: variant.id, title: variant.title, waiting: counts.get(variant.id) ?? 0 }]
        : []
    ),
  })
}
