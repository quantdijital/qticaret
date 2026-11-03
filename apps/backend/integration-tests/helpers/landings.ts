import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createAdminUser } from "./admin"
import type { HttpClient, HttpResponse } from "./http"
import { settle } from "./http"
import { indexCatalogue } from "./search-index"
import { stockShop, stockedProduct } from "./stock"
import type { StockShop } from "./stock"
import { createStorefront } from "./storefront"
import type { Storefront } from "./storefront"

export interface Landing {
  id: string
  handle: string
  path: string | null
  status: string
  originality: number
  product_count: number
  facet: { label: string | null }
}

export interface Answer {
  type: string
  status?: number
  location?: string
  entity_type?: string
  seo?: { title: string; breadcrumbs: { name: string }[]; jsonLd: Record<string, unknown>[] } | null
}

type Answered<T> = HttpResponse<T & { message?: string }>

/** A text of `count` distinct words, so originality is known. */
export const words = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index)}`).join(" ")

export const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

export interface LandingKit {
  admin: { headers: Record<string, string> }
  shop: StockShop
  store: Storefront
  /** Ev ve Yaşam, from the demo seed. */
  categoryId: string
  templateId: string
  post<T>(url: string, body: unknown): Promise<Answered<T>>
  resolve(path: string): Promise<Answer>
  /** A landing page in Ev ve Yaşam for an attribute option (`malzeme` unless named). */
  landing(
    value: string,
    body: Record<string, unknown>,
    key?: string
  ): Promise<Answered<{ landing: Landing }>>
  /** A published product with these attribute values, in the category given (Ev ve Yaşam). */
  product(handle: string, values: Record<string, unknown>, categoryId?: string): Promise<string>
}

const TEMPLATE = {
  name: "Mutfak",
  handle: "mutfak",
  definitions: [
    {
      key: "malzeme",
      label: "Malzeme",
      type: "select",
      is_filterable: true,
      options: [
        { value: "seramik", label: "Seramik" },
        { value: "porselen", label: "Porselen" },
        // Values that make no slug as they are (F3.16 handles)
        { value: "paslanmaz_celik", label: "Paslanmaz Çelik" },
        { value: "42", label: "42" },
      ],
    },
    {
      key: "renk",
      label: "Renk",
      type: "multi_select",
      is_filterable: true,
      options: [
        { value: "kirmizi", label: "Kırmızı" },
        { value: "mavi", label: "Mavi" },
      ],
    },
  ],
}

/**
 * The demo shop with a kitchen template (a single and a multiple choice
 * attribute) and four cups in Ev ve Yaşam: three ceramic, one porcelain;
 * two red, three blue.
 */
export async function landingKit(
  http: HttpClient,
  container: MedusaContainer
): Promise<LandingKit> {
  const admin = await createAdminUser(http, container)
  const store = await createStorefront(container)
  const shop = await stockShop(container)
  const post = <T>(url: string, body: unknown) =>
    settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "product_category", fields: ["id"], filters: { handle: "ev-ve-yasam" } })
  const categoryId = (data[0] as { id: string }).id
  const template = await post<{ attribute_template: { id: string } }>(
    "/admin/attribute-templates",
    TEMPLATE
  )
  const templateId = template.data.attribute_template.id
  const product = async (
    handle: string,
    values: Record<string, unknown>,
    category = categoryId
  ) => {
    const { productId } = await stockedProduct(container, shop, handle, 1)
    await post(`/admin/products/${productId}`, { categories: [{ id: category }] })
    await post(`/admin/products/${productId}/attributes`, { template_id: templateId, values })
    return productId
  }
  const cups: [string, string[]][] = [
    ["seramik", ["kirmizi", "mavi"]],
    ["seramik", ["mavi"]],
    ["seramik", ["kirmizi"]],
    ["porselen", ["mavi"]],
  ]
  for (const [index, [malzeme, renk]] of cups.entries()) {
    await product(`kupa-${String(index)}`, { malzeme, renk })
  }
  return {
    admin,
    shop,
    store,
    categoryId,
    templateId,
    post,
    product,
    // A listing's counts come from the search index (adr/0056): built first
    resolve: async (path) => {
      await indexCatalogue(container)
      return (
        await http.get<Answer>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: store.headers,
        })
      ).data
    },
    landing: (value, body, key = "malzeme") =>
      post<{ landing: Landing }>("/admin/landings", {
        category_id: categoryId,
        facet: { kind: "attribute", key, value },
        ...body,
      }),
  }
}
