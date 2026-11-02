import type { MedusaContainer } from "@medusajs/framework/types"
import type { SeoSubject } from "../../lib/seo/resolve"
import { SALE_LISTING, saleProductIds } from "../pricing/sale-products"
import { imageOf, listingItems, shopOf } from "./payload-sources"

// Its name follows the shop's language once there are more (F19), as the blog's does
const SALE_NAME = "Kampanyalı ürünler"

const ON_SALE =
  "indirimde olan ürünler: kampanyalı fiyatlarıyla, filtreleyip sıralayarak inceleyin."

const describe = (shop: string): string =>
  shop ? `${shop} mağazasında şu an ${ON_SALE}` : `Şu an ${ON_SALE}`

/**
 * The sale page's subject (`/kampanyalar`, adr/0019 ek 2026-11-03): a
 * listing of the products on sale now, titled "Kampanyalı ürünler |
 * {mağaza}", sector-free. With nothing on sale it is nobody's search
 * result (noindex, its links followed) and out of the sitemap.
 */
export async function saleSubject(
  container: MedusaContainer,
  _id: string,
  path: string
): Promise<SeoSubject> {
  const [ids, shop] = await Promise.all([saleProductIds(container), shopOf(container)])
  return {
    kind: "sale",
    path,
    name: SALE_NAME,
    description: describe(shop.name),
    tokens: {},
    overrides:
      ids.length === 0
        ? {
            seo_title: null,
            seo_description: null,
            canonical_override: null,
            robots_override: "noindex_follow",
            og_image_alt: null,
          }
        : null,
    image: await imageOf(container, null, null),
    trail: [],
    listing:
      ids.length > 0
        ? await listingItems(container, { entity_type: SALE_LISTING, entity_id: SALE_LISTING })
        : [],
  }
}
