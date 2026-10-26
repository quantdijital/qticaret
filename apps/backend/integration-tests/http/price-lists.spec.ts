import { createProductsWorkflow, updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(240 * 1000)

interface Line {
  price_id: string
  variant_id: string
  product_id: string
  product_title: string
  base: string | null
  price: string
}

interface Overlap {
  id: string
  title: string
  variant_count: number
}

interface AuditEntry {
  action: string
  resource_type: string | null
  changes: { diff?: Record<string, unknown> } | null
}

/** F4.1: price lists from the panel, a percentage worked out on the server, overlaps named. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
    })

    const send = (url: string, body: unknown) =>
      settle(http.post(url, body, { headers: admin.headers }))
    const read = <T>(url: string) => settle(http.get<T>(url, { headers: admin.headers }))

    async function priceList(body: Record<string, unknown>): Promise<string> {
      const made = await send("/admin/price-lists", {
        description: "",
        status: "active",
        type: "sale",
        ...body,
      })
      expect(made.status).toBe(200)
      return (made.data as { price_list: { id: string } }).price_list.id
    }

    const lines = async (id: string) =>
      (await read<{ lines: Line[]; overlaps: Overlap[] }>(`/admin/price-lists/${id}/lines`)).data

    it("keeps a list's prices when a variant's own price is saved, as the panel does", async () => {
      const product = await stockedProduct(getContainer(), shop, "liste-korur", 10, 100)
      await priceList({
        title: "Yaz",
        prices: [{ variant_id: product.variantId, currency_code: "try", amount: 80 }],
      })
      // The panel reads a variant's prices and sends them back with the new one
      const detail = await read<{
        product: { variants: { prices: { id: string; amount: number }[] }[] }
      }>(`/admin/products/${product.productId}?fields=variants.prices.id,variants.prices.amount`)
      const prices = detail.data.product.variants[0]?.prices ?? []
      expect(prices.map((price) => price.amount)).toEqual([100])

      const saved = await send(`/admin/products/${product.productId}/variants/batch`, {
        update: [
          {
            id: product.variantId,
            prices: [{ id: prices[0]?.id, currency_code: "try", amount: 120 }],
          },
        ],
      })
      expect(saved.status).toBe(200)
      const lists = await read<{ price_lists: { prices: { amount: number }[] }[] }>(
        "/admin/price-lists?fields=prices.amount"
      )
      expect(lists.data.price_lists[0]?.prices.map((price) => price.amount)).toEqual([80])
    })

    it("takes a percentage off the products' own prices to the kuruş, and replaces it", async () => {
      const knife = await stockedProduct(getContainer(), shop, "yuzde-a", 10, 33.33)
      const board = await stockedProduct(getContainer(), shop, "yuzde-b", 10, 100)
      const id = await priceList({ title: "Hafta sonu" })
      const products = [knife.productId, board.productId]

      const first = await send(`/admin/price-lists/${id}/discount`, {
        product_ids: products,
        percent: 15,
      })
      expect(first.data).toEqual({ priced: 2, skipped: [] })
      // 33.33 less 15% is 28.3305: half-up to the kuruş
      // By product name
      expect((await lines(id)).lines).toMatchObject([
        { product_id: knife.productId, base: "33.33", price: "28.33" },
        { product_id: board.productId, base: "100.00", price: "85.00" },
      ])

      await send(`/admin/price-lists/${id}/discount`, { product_ids: products, percent: 20 })
      const replaced = (await lines(id)).lines
      expect(replaced.map((line) => line.price)).toEqual(["26.66", "80.00"])
    })

    it("names another live list pricing the same variants on days that meet", async () => {
      const product = await stockedProduct(getContainer(), shop, "cakisan", 10, 100)
      const price = (amount: number) => [
        { variant_id: product.variantId, currency_code: "try", amount },
      ]
      const id = await priceList({
        title: "Kasım",
        starts_at: "2026-11-01T00:00:00.000Z",
        ends_at: "2026-11-30T23:59:59.000Z",
        prices: price(90),
      })
      const meets = await priceList({
        title: "Kara Cuma",
        type: "override",
        starts_at: "2026-11-20T00:00:00.000Z",
        prices: price(70),
      })
      // A draft, and a list over before this one starts, are no clash
      await priceList({ title: "Taslak", status: "draft", prices: price(60) })
      await priceList({
        title: "Ekim",
        starts_at: "2026-10-01T00:00:00.000Z",
        ends_at: "2026-10-31T23:59:59.000Z",
        prices: price(85),
      })

      // A list over yesterday, though its open start would meet any days
      await priceList({
        title: "Dün bitti",
        ends_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        prices: price(75),
      })

      const { overlaps } = await lines(id)
      expect(overlaps.map((overlap) => [overlap.id, overlap.variant_count])).toEqual([[meets, 1]])
    })

    it("opens a list for a customer group to everyone when its rules are emptied", async () => {
      const group = await send("/admin/customer-groups", { name: "Toptancılar" })
      const groupId = (group.data as { customer_group: { id: string } }).customer_group.id
      const id = await priceList({ title: "Bayi", rules: { "customer.groups.id": [groupId] } })
      const rulesOf = async () =>
        (await read<{ price_list: { rules: Record<string, unknown> } }>(`/admin/price-lists/${id}`))
          .data.price_list.rules
      expect(await rulesOf()).toEqual({ "customer.groups.id": [groupId] })

      // As the panel saves "everyone"
      expect((await send(`/admin/price-lists/${id}`, { rules: {} })).status).toBe(200)
      expect(await rulesOf()).toEqual({})
    })

    it("puts a new rate on the list's own lines only, never one taken out", async () => {
      const { result } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: "İki seçenekli",
              handle: "iki-secenekli",
              // A draft: a published physical product needs its dimensions (F3.1)
              status: "draft",
              shipping_profile_id: shop.shippingProfileId,
              options: [{ title: "Boy", values: ["S", "L"] }],
              variants: ["S", "L"].map((size) => ({
                title: size,
                options: { Boy: size },
                manage_inventory: false,
                prices: [{ currency_code: "try", amount: size === "S" ? 100 : 50 }],
              })),
            },
          ],
        },
      })
      const productId = result[0]?.id ?? ""
      const id = await priceList({ title: "Seçenekler" })
      await send(`/admin/price-lists/${id}/discount`, { product_ids: [productId], percent: 10 })
      const [large] = (await lines(id)).lines.filter((line) => line.price === "45.00")
      expect(large).toBeDefined()
      // L is taken out to sell at its own price, then the list gets a new rate
      await send(`/admin/price-lists/${id}/prices/batch`, { delete: [large?.price_id] })
      const renewed = await send(`/admin/price-lists/${id}/discount`, {
        product_ids: [productId],
        percent: 20,
        only_listed: true,
      })
      expect(renewed.data).toEqual({ priced: 1, skipped: [] })
      expect((await lines(id)).lines.map((line) => line.price)).toEqual(["80.00"])
    })

    it("takes no tier price for a variant's own, and writes nothing for unknown products", async () => {
      const product = await stockedProduct(getContainer(), shop, "kademeli", 10, 100)
      await updateProductVariantsWorkflow(getContainer()).run({
        input: {
          product_variants: [
            {
              id: product.variantId,
              prices: [
                { currency_code: "try", amount: 70, min_quantity: 10 },
                { currency_code: "try", amount: 100 },
              ],
            },
          ],
        },
      })
      const id = await priceList({ title: "Kademe" })
      await send(`/admin/price-lists/${id}/discount`, {
        product_ids: [product.productId],
        percent: 10,
      })
      expect((await lines(id)).lines).toMatchObject([{ base: "100.00", price: "90.00" }])

      const nothing = await send(`/admin/price-lists/${id}/discount`, {
        product_ids: ["prod_unknown"],
        percent: 10,
      })
      expect({ status: nothing.status, body: nothing.data }).toEqual({
        status: 200,
        body: { priced: 0, skipped: [] },
      })
    })

    it("refuses a percentage outside its bounds, and an unknown list", async () => {
      const product = await stockedProduct(getContainer(), shop, "sinir", 10, 100)
      const id = await priceList({ title: "Sınır" })
      for (const percent of [0, 99.5, 12.345]) {
        const refused = await send(`/admin/price-lists/${id}/discount`, {
          product_ids: [product.productId],
          percent,
        })
        expect({ percent, status: refused.status }).toEqual({ percent, status: 400 })
      }
      const unknown = await send("/admin/price-lists/plist_unknown/discount", {
        product_ids: [product.productId],
        percent: 10,
      })
      expect(unknown.status).toBe(404)
      expect((await read("/admin/price-lists/plist_unknown/lines")).status).toBe(404)
    })

    it("records a percentage written into a list, price by price", async () => {
      const product = await stockedProduct(getContainer(), shop, "kayitli", 10, 100)
      const id = await priceList({ title: "Kayıt" })
      await send(`/admin/price-lists/${id}/discount`, {
        product_ids: [product.productId],
        percent: 10,
      })
      let entry: AuditEntry | undefined
      // Written once the response has finished, so it may land a moment after
      for (let attempt = 0; attempt < 30 && !entry; attempt++) {
        const { data } = await read<{ audit_entries: AuditEntry[] }>(
          `/admin/audit-log?resource_id=${id}&kind=mutation`
        )
        entry = data.audit_entries[0]
        if (!entry) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
      expect(entry).toMatchObject({
        action: "POST /admin/price-lists/:id/discount",
        resource_type: "price_list",
      })
      expect(JSON.stringify(entry?.changes?.diff)).toContain('"after":"90 try"')
    })
  },
})
