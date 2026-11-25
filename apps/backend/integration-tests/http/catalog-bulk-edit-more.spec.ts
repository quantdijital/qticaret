import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { serverErrorMessage } from "../../src/lib/errors/messages"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(300 * 1000)

interface Preview {
  products: number
  changed: number
  unchanged: number
  skipped: number
  problems: { handle: string; title: string | null; message: string }[]
}

/**
 * WooCommerce's bulk edit fields (brand, tag, selling past stock, sale
 * price) through the jobs route, and the preview that counts what a
 * change would do before it is applied, writing nothing.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    const sheets = sheetClient(http, getContainer, () => admin.headers)
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    async function bulk(productIds: string[], change: Record<string, unknown>) {
      const queued = await settle(
        http.post<{ async_job: SheetJob }>(
          "/admin/async-jobs",
          { type: "catalog.bulk_edit", input: { product_ids: productIds, change } },
          { headers: admin.headers }
        )
      )
      expect(queued.status).toBe(202)
      return sheets.settled(queued.data.async_job.id)
    }

    const preview = (productIds: string[], change: Record<string, unknown>) =>
      settle(
        http.post<{ preview: Preview }>(
          "/admin/catalog/bulk-edit/preview",
          { product_ids: productIds, change },
          { headers: admin.headers }
        )
      )

    async function productOf(id: string, fields: string[]) {
      const { data } = await query().graph({ entity: "product", fields, filters: { id } })
      return data[0] as unknown as Record<string, unknown>
    }

    async function saleOf(productId: string) {
      const read = await settle(
        http.get<{ variants: { sale: { amount: string } | null }[] }>(
          `/admin/products/${productId}/sale-prices`,
          { headers: admin.headers }
        )
      )
      return read.data.variants[0]?.sale?.amount ?? null
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
    })

    it("previews a sale without writing it, then applies it worked out on the server and clears it", async () => {
      const a = await stockedProduct(getContainer(), shop, "toplu-indirim-a", 1, 200)
      const b = await stockedProduct(getContainer(), shop, "toplu-indirim-b", 1, 50)
      const ids = [a.productId, b.productId, "prod_yok"]
      const change = { action: "sale", mode: "amount", value: 60 }

      const seen = await preview(ids, change)
      expect(seen.status).toBe(200)
      expect(seen.data.preview).toMatchObject({ products: 3, changed: 1, unchanged: 0, skipped: 2 })
      expect(seen.data.preview.problems).toEqual(
        expect.arrayContaining([
          {
            handle: "toplu-indirim-b",
            title: "toplu-indirim-b",
            message: serverErrorMessage("bulk_edit.sale_out_of_range", "tr"),
          },
          {
            handle: "prod_yok",
            title: null,
            message: serverErrorMessage("bulk_edit.product_missing", "tr"),
          },
        ])
      )
      // Nothing written by the preview
      expect(await saleOf(a.productId)).toBeNull()

      const job = await bulk(ids, change)
      expect(job).toMatchObject({
        status: "succeeded",
        result_summary: { action: "sale", changed: 1, skipped: 2, failed: 0 },
      })
      expect((job.result_summary as { problems: unknown[] }).problems).toHaveLength(2)
      expect(await saleOf(a.productId)).toBe("140.00")

      const percent = await bulk([a.productId], { action: "sale", mode: "percent", value: 25 })
      expect(percent.result_summary).toMatchObject({ changed: 1 })
      expect(await saleOf(a.productId)).toBe("150.00")

      const cleared = await bulk([a.productId, b.productId], { action: "sale", mode: "clear" })
      expect(cleared.result_summary).toMatchObject({ changed: 1, unchanged: 1 })
      expect(await saleOf(a.productId)).toBeNull()
    })

    it("refuses a sale with a total in it, or a share of 100%", async () => {
      const a = await stockedProduct(getContainer(), shop, "toplu-indirim-red", 1)
      for (const change of [
        { action: "sale", mode: "percent", value: 10, amount: 1 },
        { action: "sale", mode: "percent", value: 100 },
      ]) {
        expect((await preview([a.productId], change)).status).toBe(400)
      }
    })

    it("adds a tag, making it once, and takes it off again", async () => {
      const a = await stockedProduct(getContainer(), shop, "toplu-etiket-a", 1)
      const b = await stockedProduct(getContainer(), shop, "toplu-etiket-b", 1)
      const name = `Kış ${String(Date.now())}`
      // The preview makes no tag
      const seen = await preview([a.productId, b.productId], {
        action: "tag",
        mode: "add",
        value: name,
      })
      expect(seen.data.preview).toMatchObject({ changed: 2 })
      const tagsNamed = async () =>
        (await query().graph({ entity: "product_tag", fields: ["id"], filters: { value: name } }))
          .data as unknown[]
      expect(await tagsNamed()).toHaveLength(0)

      const added = await bulk([a.productId, b.productId], {
        action: "tag",
        mode: "add",
        value: name,
      })
      expect(added.result_summary).toMatchObject({ changed: 2 })
      expect(await tagsNamed()).toHaveLength(1)
      const tagValues = async (id: string) =>
        ((await productOf(id, ["tags.value"]))["tags"] as { value: string }[]).map(
          (tag) => tag.value
        )
      expect(await tagValues(b.productId)).toEqual([name])
      // Letter case aside, the same tag: nothing to add
      const again = await bulk([a.productId], {
        action: "tag",
        mode: "add",
        value: name.toLocaleUpperCase("tr"),
      })
      expect(again.result_summary).toMatchObject({ changed: 0, unchanged: 1 })

      const removed = await bulk([a.productId], { action: "tag", mode: "remove", value: name })
      expect(removed.result_summary).toMatchObject({ changed: 1 })
      expect(await tagValues(a.productId)).toEqual([])
      expect(await tagValues(b.productId)).toEqual([name])

      // Taking off a tag the shop does not have is refused for the whole change
      const unknown = await preview([a.productId], {
        action: "tag",
        mode: "remove",
        value: `Yok ${String(Date.now())}`,
      })
      expect(unknown.status).toBe(400)
    })

    it("sets and takes off a brand", async () => {
      const a = await stockedProduct(getContainer(), shop, "toplu-marka-a", 1)
      const brand = await settle(
        http.post<{ brand: { id: string } }>(
          "/admin/brands",
          { name: `Usta ${String(Date.now())}` },
          { headers: admin.headers }
        )
      )
      expect(brand.status).toBe(201)
      const brandId = brand.data.brand.id
      const brandOf = async () =>
        ((await productOf(a.productId, ["brand.id"]))["brand"] as { id: string } | null)?.id ?? null

      expect(
        (await bulk([a.productId], { action: "brand", brand_id: brandId })).result_summary
      ).toMatchObject({ changed: 1 })
      expect(await brandOf()).toBe(brandId)
      expect(
        (await preview([a.productId], { action: "brand", brand_id: brandId })).data.preview
      ).toMatchObject({ unchanged: 1 })
      await bulk([a.productId], { action: "brand", brand_id: null })
      expect(await brandOf()).toBeNull()
      expect(
        (await preview([a.productId], { action: "brand", brand_id: "brand_yok" })).status
      ).toBe(400)
    })

    it("turns selling past stock on for tracked variants and leaves untracked ones", async () => {
      const tracked = await stockedProduct(getContainer(), shop, "toplu-on-siparis", 1)
      const untracked = await stockedProduct(getContainer(), shop, "toplu-takipsiz", null)
      await getContainer()
        .resolve(Modules.PRODUCT)
        .updateProductVariants(untracked.variantId, { manage_inventory: false })
      const job = await bulk([tracked.productId, untracked.productId], {
        action: "backorder",
        allow: true,
      })
      expect(job.result_summary).toMatchObject({ changed: 1, skipped: 1 })
      const variantOf = async (id: string) =>
        (
          (await productOf(id, ["variants.allow_backorder", "variants.manage_inventory"]))[
            "variants"
          ] as { allow_backorder: boolean; manage_inventory: boolean }[]
        )[0]
      expect(await variantOf(tracked.productId)).toMatchObject({ allow_backorder: true })
      expect(await variantOf(untracked.productId)).toEqual({
        allow_backorder: false,
        manage_inventory: false,
      })
    })
  },
})
