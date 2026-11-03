import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import type { HttpClient, HttpResponse } from "./http"
import { settle } from "./http"
import { indexCatalogue } from "./search-index"
import { stockShop } from "./stock"
import type { StockShop } from "./stock"
import { createStorefront } from "./storefront"
import type { Storefront } from "./storefront"

export interface SearchAnswer {
  product_ids: string[]
  count: number
  facets: {
    brands: { value: string; count: number }[]
    attributes: { key: string; values: { value: string; count: number }[] }[]
    price: { min: number; max: number } | null
    stock: { count: number; selected: boolean }
  }
  search?: {
    suggestions: string[]
    related: { categories: { id: string; name: string }[]; brands: { id: string }[] }
    took_ms: number
  }
  message?: string
}

export interface ProductSpec {
  title: string
  subtitle?: string
  description?: string
  category_ids?: string[]
  /** Option values: a variant each. */
  option?: { title: string; value: string }
  sku?: string
  /** Kept in stock with no count unless false: then out of stock. */
  inStock?: boolean
  status?: "published" | "draft"
  sales_channel_id?: string
  price?: number
}

export interface SearchKit {
  shop: StockShop
  store: Storefront
  product(spec: ProductSpec): Promise<string>
  category(name: string): Promise<string>
  /** Indexes the catalogue (unless `indexed: false`), then searches. */
  search(
    q: string,
    query?: Record<string, string>,
    options?: { indexed?: boolean }
  ): Promise<HttpResponse<SearchAnswer>>
}

let made = 0

/** The demo shop, a storefront key, and products made straight through Medusa's workflow. */
export async function searchKit(http: HttpClient, container: MedusaContainer): Promise<SearchKit> {
  const shop = await stockShop(container)
  const store = await createStorefront(container)
  return {
    shop,
    store,
    product: async (spec) => {
      made += 1
      const option = spec.option ?? { title: "Seçenek", value: "Standart" }
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: spec.title,
              handle: `arama-${String(made)}-${String(Date.now())}`,
              status: spec.status ?? "published",
              ...(spec.subtitle ? { subtitle: spec.subtitle } : {}),
              ...(spec.description ? { description: spec.description } : {}),
              ...(spec.category_ids ? { category_ids: spec.category_ids } : {}),
              weight: 500,
              length: 10,
              width: 10,
              height: 10,
              shipping_profile_id: shop.shippingProfileId,
              options: [{ title: option.title, values: [option.value] }],
              variants: [
                {
                  title: option.value,
                  options: { [option.title]: option.value },
                  ...(spec.sku ? { sku: spec.sku } : {}),
                  manage_inventory: spec.inStock === false,
                  prices: [{ currency_code: "try", amount: spec.price ?? 100 }],
                },
              ],
              sales_channels: [{ id: spec.sales_channel_id ?? shop.salesChannelId }],
            },
          ],
        },
      })
      return result[0]?.id ?? ""
    },
    category: async (name) => {
      made += 1
      const [category] = await container
        .resolve(Modules.PRODUCT)
        .createProductCategories([
          { name, handle: `arama-kategori-${String(made)}`, is_active: true, is_internal: false },
        ])
      return category?.id ?? ""
    },
    search: async (q, query = {}, options = {}) => {
      if (options.indexed !== false) {
        await indexCatalogue(container)
      }
      return settle(
        http.get<SearchAnswer>(
          `/store/listings/products?${new URLSearchParams({
            type: "search",
            q,
            region_id: shop.regionId,
            currency_code: "try",
            query: new URLSearchParams(query).toString(),
          }).toString()}`,
          { headers: store.headers }
        )
      )
    },
  }
}

/** The answer's ids among these, in its order: the demo catalogue's own left out. */
export const among = (answer: SearchAnswer, ids: readonly string[]): string[] =>
  answer.product_ids.filter((id) => ids.includes(id))
