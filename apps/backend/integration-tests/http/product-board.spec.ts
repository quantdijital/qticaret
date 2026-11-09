import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

interface Board {
  ids: string[]
  count: number
  limited: boolean
}

interface MadeProduct {
  id: string
  variants: { id: string }[]
}

interface ProductInput {
  status?: "published" | "draft"
  price?: number | null
  manage?: boolean
  thumbnail?: boolean
  description?: string
  categories?: string[]
}

/** The panel's product list (adr/0022): Medusa's filters and the ones it cannot do. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const board = async (query: string) =>
      (await http.get<Board>(`/admin/product-board?${query}`, { headers: admin.headers })).data

    async function make(title: string, input: ProductInput = {}): Promise<MadeProduct> {
      const { data, status } = await post<{ product: MadeProduct }>("/admin/products", {
        title,
        status: input.status ?? "published",
        description: input.description ?? "Paslanmaz çelik.",
        ...(input.thumbnail === false
          ? {}
          : {
              thumbnail: "https://cdn.example/x.jpg",
              images: [{ url: "https://cdn.example/x.jpg" }],
            }),
        categories: (input.categories ?? []).map((id) => ({ id })),
        options: [{ title: "Boyut", values: ["Standart"] }],
        variants: [
          {
            title: "Standart",
            options: { Boyut: "Standart" },
            manage_inventory: input.manage ?? false,
            prices:
              input.price === null ? [] : [{ currency_code: "try", amount: input.price ?? 1000 }],
          },
        ],
      })
      expect(status).toBe(200)
      return data.product
    }

    async function stock(product: MadeProduct, quantity: number, locationId: string) {
      const container = getContainer()
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: product.variants[0]?.id ?? "" },
      })
      const itemId =
        (data[0] as { inventory_items: { inventory_item_id: string }[] }).inventory_items[0]
          ?.inventory_item_id ?? ""
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            { inventory_item_id: itemId, location_id: locationId, stocked_quantity: quantity },
          ],
        },
      })
    }

    const category = async (name: string, parent?: string) =>
      (
        await post<{ product_category: { id: string } }>("/admin/product-categories", {
          name,
          is_active: true,
          ...(parent ? { parent_category_id: parent } : {}),
        })
      ).data.product_category.id

    it("filters by state, a category and the ones below it, a brand; orders by title and price", async () => {
      const knives = await category("Bıçaklar")
      const chef = await category("Şef Bıçakları", knives)
      const handle = await make("Ağaç Saplı", { categories: [chef], price: 300 })
      const folding = await make("Çakı", { status: "draft", categories: [knives], price: 100 })
      const stone = await make("Zımpara Taşı", { price: 200 })
      const brand = (await post<{ brand: { id: string } }>("/admin/brands", { name: "Örnek" })).data
        .brand
      await post(`/admin/products/${stone.id}/brand`, { brand_id: brand.id })

      expect(await board(`category_id=${knives}&order=title`)).toEqual({
        ids: [handle.id, folding.id],
        count: 2,
        limited: false,
      })
      expect((await board(`category_id=${chef}`)).ids).toEqual([handle.id])
      expect((await board("status=draft")).ids).toEqual([folding.id])
      expect((await board(`brand_id=${brand.id}`)).ids).toEqual([stone.id])
      expect((await board("order=price")).ids).toEqual([folding.id, stone.id, handle.id])
      expect((await board("order=-price&limit=2")).ids).toEqual([handle.id, stone.id])
      expect((await board("order=-price&limit=2&offset=2")).count).toBe(3)
      expect((await board("q=Çakı")).ids).toEqual([folding.id])
      expect((await board("brand_id=brand_nope")).count).toBe(0)

      const refused = await settle(
        http.get("/admin/product-board?order=cheapest", { headers: admin.headers })
      )
      expect(refused.status).toBe(400)
    })

    it("finds products by where their stock stands and by what they lack", async () => {
      const { result } = await createStockLocationsWorkflow(getContainer()).run({
        input: { locations: [{ name: "Depo" }] },
      })
      const locationId = result[0]?.id ?? ""
      const out = await make("Tükenen", { manage: true })
      const low = await make("Azalan", { manage: true })
      const plenty = await make("Bol", { manage: true })
      const untracked = await make("Sayılmayan", { price: null, thumbnail: false, description: "" })
      await stock(out, 0, locationId)
      await stock(low, 2, locationId)
      await stock(plenty, 50, locationId)

      expect((await board("stock=out")).ids).toEqual([out.id])
      expect((await board("stock=low")).ids).toEqual([low.id])
      expect((await board("stock=in")).ids.sort()).toEqual([plenty.id, untracked.id].sort())
      expect((await board("order=stock")).ids).toEqual([out.id, low.id, plenty.id, untracked.id])
      expect((await board("missing=image")).ids).toEqual([untracked.id])
      expect((await board("missing=price")).ids).toEqual([untracked.id])
      expect((await board("missing=description")).ids).toEqual([untracked.id])
      expect((await board("kind=digital")).count).toBe(0)
      expect((await board("kind=physical")).count).toBe(4)
    })
  },
})
