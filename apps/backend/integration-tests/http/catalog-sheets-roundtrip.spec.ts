import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createPriceListsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { readXlsx } from "../../src/lib/sheets"
import { importProductWorkflow } from "../../src/workflows/catalog/import/import-product"
import type { ImportPlan } from "../../src/workflows/catalog/import/plan"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { at, row, sheetClient, xlsxOf } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(300 * 1000)

interface ProductRow {
  title: string
  description: string | null
  seo_meta: { seo_title: string } | null
  variants: {
    prices: { amount: number | string; currency_code: string }[]
    inventory_items: { inventory: { location_levels: { stocked_quantity: number }[] } }[]
  }[]
}

/**
 * F3.9 (adr/0018): a sheet against products that exist, an export read
 * back as it is, and a product undone when a later step fails.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    const sheets = sheetClient(http, getContainer, () => admin.headers)

    async function productOf(id: string): Promise<ProductRow> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          fields: [
            "title",
            "description",
            "seo_meta.seo_title",
            "variants.prices.amount",
            "variants.prices.currency_code",
            "variants.inventory_items.inventory.location_levels.stocked_quantity",
          ],
          filters: { id },
        })
      return data[0] as unknown as ProductRow
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
    })

    it("replaces the base TRY price only (price lists, other currencies kept), stock and SEO", async () => {
      const { productId, variantId } = await stockedProduct(
        getContainer(),
        shop,
        "var-olan-kupa",
        2
      )
      await updateProductVariantsWorkflow(getContainer()).run({
        input: {
          product_variants: [
            {
              id: variantId,
              sku: "VAR-OLAN-1",
              prices: [
                { currency_code: "try", amount: 100 },
                { currency_code: "eur", amount: 5 },
              ],
            },
          ],
        },
      })
      await createPriceListsWorkflow(getContainer()).run({
        input: {
          price_lists_data: [
            {
              title: "Kampanya",
              description: "İndirim",
              status: "active",
              prices: [{ variant_id: variantId, amount: 70, currency_code: "try" }],
            },
          ],
        },
      })
      await stockedProduct(getContainer(), shop, "diger-kupa", 1)
      const applied = await sheets.upload(
        await xlsxOf([
          row({ handle: "var-olan-kupa", price: 150, stock: 7, seo_title: "Yeni başlık" }),
          row({ handle: "diger-kupa", option1_name: "Seçenek", option1_value: "Büyük", price: 10 }),
          row({ handle: "yeni-tabak", title: "Yeni Tabak", sku: "VAR-OLAN-1" }),
        ]),
        "apply"
      )
      expect(applied.result_summary).toMatchObject({ create: 0, update: 1, problems: 2, failed: 0 })
      const report = await sheets.fileOf(applied)
      const messageOf = (handle: string) => report.find((cells) => cells[1] === handle)?.[4]
      expect(messageOf("diger-kupa")).toBe("Yeni seçenek değeri; önce panelden ürüne ekleyin.")
      expect(messageOf("yeni-tabak")).toBe("Bu SKU başka bir ürünün varyantında kullanılıyor.")

      const product = await productOf(productId)
      expect(product.seo_meta?.seo_title).toBe("Yeni başlık")
      const prices = (product.variants[0]?.prices ?? []).map((price) => [
        price.currency_code,
        Number(price.amount),
      ])
      expect(prices).toEqual(
        expect.arrayContaining([
          ["try", 150],
          ["eur", 5],
        ])
      )
      // The price list's price is the price list's: still there
      const { data: lists } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "price_list", fields: ["prices.amount"], filters: { title: "Kampanya" } })
      const listed =
        (lists[0] as { prices?: { amount: number | string }[] } | undefined)?.prices ?? []
      expect(listed.map((price) => Number(price.amount))).toEqual([70])
      expect(
        product.variants[0]?.inventory_items[0]?.inventory.location_levels[0]?.stocked_quantity
      ).toBe(7)
    })

    it("exports cells escaped against formulas (KK); its file applied as it is changes nothing", async () => {
      const { productId } = await stockedProduct(getContainer(), shop, "formul-kupa", 4)
      await http.post(
        `/admin/products/${productId}`,
        { title: '=HYPERLINK("x") Kupa', description: "Birinci satır\nİkinci satır" },
        { headers: admin.headers }
      )
      const queued = await http.post<{ async_job: SheetJob }>(
        "/admin/async-jobs",
        { type: "catalog.export", input: { format: "xlsx" } },
        { headers: admin.headers }
      )
      const exported = await sheets.settled(queued.data.async_job.id)
      expect(exported.status).toBe("succeeded")
      const file = await sheets.fileBytes(exported)
      const raw = await readXlsx(file, { maxRows: 10_000, maxCells: 200 })
      const cells = raw.ok
        ? raw.rows.find((each) => each.cells[at("handle")] === "formul-kupa")?.cells
        : []
      expect(cells?.[at("title")]).toBe('\'=HYPERLINK("x") Kupa')
      expect(cells?.[at("description")]).toBe("Birinci satır\nİkinci satır")
      expect(cells?.[at("stock")]).toBe("4")

      const applied = await sheets.upload(file, "apply")
      expect(applied.result_summary).toMatchObject({ create: 0, update: 0, problems: 0, failed: 0 })
      expect(Number(applied.result_summary?.["unchanged"])).toBeGreaterThan(0)
      expect(await productOf(productId)).toMatchObject({
        title: '=HYPERLINK("x") Kupa',
        description: "Birinci satır\nİkinci satır",
      })
    })

    it("undoes a new product whose later step fails", async () => {
      const plan: ImportPlan = {
        handle: "geri-alinan",
        line: 2,
        productId: null,
        product: {
          title: "Geri Alınan",
          handle: "geri-alinan",
          status: "draft",
          shipping_profile_id: shop.shippingProfileId,
        },
        options: [{ title: "Seçenek", values: ["Standart"] }],
        variantCreates: [
          {
            title: "Geri Alınan",
            options: { Seçenek: "Standart" },
            manage_inventory: true,
            prices: [],
          },
        ],
        variantUpdates: [],
        stock: [],
        seo: { seo_title: "Geri alınan ürün" },
        // A template that is not there: the attribute step fails after the product was made
        attributes: { template_id: "atmpl_yok", values: {} },
      }
      await expect(
        importProductWorkflow(getContainer()).run({ input: { plan, location_id: null } })
      ).rejects.toBeTruthy()
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product", fields: ["id"], filters: { handle: "geri-alinan" } })
      expect(data).toHaveLength(0)
    })
  },
})
