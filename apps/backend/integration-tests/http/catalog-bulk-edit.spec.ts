import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  batchImageVariantsWorkflow,
  createPriceListsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { serverErrorMessage } from "../../src/lib/errors/messages"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { STOCK_LEDGER_MODULE } from "../../src/modules/stock-ledger"
import type StockLedgerModuleService from "../../src/modules/stock-ledger/service"
import { bulkCategoryWorkflow } from "../../src/workflows/catalog/bulk-edit/write"
import { setProductCatalogWorkflow } from "../../src/workflows/catalog/set-product-catalog"
import { upsertSeoMetaWorkflow } from "../../src/workflows/seo/upsert-seo-meta"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(300 * 1000)

/** F3.10: one change to many products, through the jobs route, as the panel sends it. */
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

    async function productOf(id: string, fields: string[]) {
      const { data } = await query().graph({ entity: "product", fields, filters: { id } })
      return data[0] as unknown as Record<string, unknown>
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
    })

    it("changes the base TRY price by a percent, keeping other currencies and price lists", async () => {
      const a = await stockedProduct(getContainer(), shop, "toplu-a", 1)
      const b = await stockedProduct(getContainer(), shop, "toplu-b", 1)
      const unpriced = await stockedProduct(getContainer(), shop, "toplu-fiyatsiz", 1)
      await updateProductVariantsWorkflow(getContainer()).run({
        input: {
          product_variants: [
            {
              id: a.variantId,
              prices: [
                { currency_code: "try", amount: 100 },
                { currency_code: "eur", amount: 5 },
              ],
            },
            // Only a euro price: a percent has no TRY price to change
            { id: unpriced.variantId, prices: [{ currency_code: "eur", amount: 9 }] },
          ],
        },
      })
      await createPriceListsWorkflow(getContainer()).run({
        input: {
          price_lists_data: [
            {
              title: "Toplu kampanya",
              description: "İndirim",
              status: "active",
              prices: [{ variant_id: a.variantId, amount: 70, currency_code: "try" }],
            },
          ],
        },
      })

      const job = await bulk([a.productId, b.productId, unpriced.productId, "prod_yok"], {
        action: "price",
        mode: "percent",
        value: 12.5,
      })
      expect(job).toMatchObject({
        status: "succeeded",
        result_summary: { action: "price", products: 4, changed: 2, skipped: 2, failed: 0 },
      })
      const prices = (product: Record<string, unknown>) =>
        (
          (product["variants"] as { prices: { currency_code: string; amount: unknown }[] }[])[0]
            ?.prices ?? []
        ).map((price) => [price.currency_code, Number(price.amount)])
      const fields = ["variants.prices.amount", "variants.prices.currency_code"]
      expect(prices(await productOf(a.productId, fields))).toEqual(
        expect.arrayContaining([
          ["try", 112.5],
          ["eur", 5],
        ])
      )
      expect(prices(await productOf(b.productId, fields))).toEqual([["try", 112.5]])
      const { data: lists } = await query().graph({
        entity: "price_list",
        fields: ["prices.amount"],
        filters: { title: "Toplu kampanya" },
      })
      const listed = (lists[0] as { prices?: { amount: unknown }[] } | undefined)?.prices ?? []
      expect(listed.map((price) => Number(price.amount))).toEqual([70])

      const report = await sheets.fileOf(job)
      const messageOf = (handle: string) => report.find((cells) => cells[0] === handle)?.[3]
      expect(messageOf("toplu-fiyatsiz")).toBe(serverErrorMessage("bulk_edit.no_price", "tr"))
      expect(messageOf("prod_yok")).toBe(serverErrorMessage("bulk_edit.product_missing", "tr"))
      // In the audit log as it started and as it ended, with what it changed (adr/0011)
      const entries = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ resource_id: job.id }, { select: ["action", "changes"] })
      expect(entries.map((entry) => entry.action).sort()).toEqual([
        "catalog.bulk_edit_finished",
        "catalog.bulk_edit_started",
      ])
      const finished = entries.find((entry) => entry.action === "catalog.bulk_edit_finished")
      expect(finished?.changes).toMatchObject({ product_ids: [a.productId, b.productId] })
      // And each product's own entry, its price before and after (as the price routes record)
      const [own] = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries(
          {
            resource_type: "product",
            resource_id: a.productId,
            action: "catalog.bulk_edit_product",
          },
          { select: ["changes", "actor_id"] }
        )
      expect(own?.changes).toMatchObject({
        job_id: job.id,
        action: "price",
        diff: { [`variant:${a.variantId}:price:try`]: { before: 100, after: 112.5 } },
      })
      expect(own?.actor_id).toBeTruthy()
      // The jobs list shows how many products, not the thousand ids
      const { data } = await http.get<{ async_job: { input: Record<string, unknown> } }>(
        `/admin/async-jobs/${job.id}`,
        { headers: admin.headers }
      )
      expect(data.async_job.input).toMatchObject({ product_count: 4 })
      expect(data.async_job.input["product_ids"]).toBeUndefined()
    })

    it("sets stock with the ledger's bulk edit reason, the job and its requester", async () => {
      const shelved = await stockedProduct(getContainer(), shop, "toplu-raf", 2)
      const bare = await stockedProduct(getContainer(), shop, "toplu-bos", null)
      const job = await bulk([shelved.productId, bare.productId], {
        action: "stock",
        mode: "set",
        value: 9,
      })
      expect(job.result_summary).toMatchObject({ changed: 2, failed: 0 })
      const [record] = await getContainer()
        .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
        .listAsyncJobs({ id: job.id }, { select: ["requested_by"] })
      const ledger = getContainer().resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
      for (const itemId of [shelved.itemId, bare.itemId]) {
        expect(await ledger.lastMovement(itemId, shop.locationId)).toMatchObject({
          stocked_after: 9,
          reason: "bulk_edit",
          reference: job.id,
          actor_id: record?.requested_by,
        })
      }
      const taken = await bulk([shelved.productId], { action: "stock", mode: "adjust", value: -20 })
      expect(taken.result_summary).toMatchObject({ changed: 0, skipped: 1 })
      // Added by a number under the item's lock, recorded as the bulk edit's
      const added = await bulk([shelved.productId], { action: "stock", mode: "adjust", value: 3 })
      expect(added.result_summary).toMatchObject({ changed: 1 })
      expect(await ledger.lastMovement(shelved.itemId, shop.locationId)).toMatchObject({
        delta_stocked: 3,
        stocked_after: 12,
        reason: "bulk_edit",
        reference: added.id,
      })
    })

    it("sets, raises and clears the variants' unit cost through the catalog save", async () => {
      const cup = await stockedProduct(getContainer(), shop, "toplu-maliyet", 4)
      const costOf = async () => {
        const product = await productOf(cup.productId, ["variants.variant_extension.cost"])
        const [variant] = product["variants"] as { variant_extension?: { cost: number | null } }[]
        return variant?.variant_extension?.cost ?? null
      }

      const set = await bulk([cup.productId], { action: "cost", mode: "set", value: 40 })
      const afterSet = await costOf()
      const raised = await bulk([cup.productId], { action: "cost", mode: "percent", value: 12.5 })
      const afterRaise = await costOf()
      const cleared = await bulk([cup.productId], { action: "cost", mode: "clear" })
      const bad = await settle(
        http.post(
          "/admin/async-jobs",
          {
            type: "catalog.bulk_edit",
            input: { product_ids: [cup.productId], change: { action: "cost", mode: "set" } },
          },
          { headers: admin.headers }
        )
      )

      expect(set.result_summary).toMatchObject({ changed: 1, failed: 0 })
      // Kuruş in the store: 40,00 ₺ and then 45,00 ₺
      expect(afterSet).toBe(4000)
      expect(raised.result_summary).toMatchObject({ changed: 1 })
      expect(afterRaise).toBe(4500)
      expect(cleared.result_summary).toMatchObject({ changed: 1 })
      expect(await costOf()).toBeNull()
      expect(bad.status).toBe(400)
    })

    it("takes drafts live through the SEO gate, measured or not (adr/0054)", async () => {
      const ready = await stockedProduct(getContainer(), shop, "toplu-hazir", 1)
      const { result } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: "Ölçüsüz",
              handle: "toplu-olcusuz",
              status: "draft",
              shipping_profile_id: shop.shippingProfileId,
              options: [{ title: "Seçenek", values: ["Standart"] }],
              variants: [{ title: "Standart", options: { Seçenek: "Standart" }, prices: [] }],
            },
          ],
        },
      })
      const unmeasured = result[0]?.id ?? ""
      await updateProductsWorkflow(getContainer()).run({
        input: { selector: { id: ready.productId }, update: { status: "draft" } },
      })
      const settings =
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.setFeature("seo.publish_gate", true, null)
      try {
        // No image: a critical finding holds it back, as the product route would
        const held = await bulk([ready.productId], { action: "status", status: "published" })
        expect(held.result_summary).toMatchObject({ changed: 0, skipped: 1 })
        const report = await sheets.fileOf(held)
        expect(report.find((cells) => cells[0] === "toplu-hazir")?.[3]).toBe(
          serverErrorMessage("seo.publish_gate_blocked", "tr")
        )
      } finally {
        await settings.setFeature("seo.publish_gate", false, null)
      }
      const job = await bulk([ready.productId, unmeasured], {
        action: "status",
        status: "published",
      })
      // Weight and dimensions are optional (adr/0054): a product without them goes live too
      expect(job.result_summary).toMatchObject({ changed: 2, failed: 0 })
      expect(await productOf(ready.productId, ["status"])).toMatchObject({ status: "published" })
      expect(await productOf(unmeasured, ["status"])).toMatchObject({ status: "published" })
    })

    it("files products under a category, makes it primary, and takes it away again", async () => {
      const { result: categories } = await createProductCategoriesWorkflow(getContainer()).run({
        input: {
          product_categories: [
            { name: "Mutfak", handle: "toplu-mutfak", is_active: true },
            { name: "Kupalar", handle: "toplu-kupalar", is_active: true },
            { name: "Diğer", handle: "toplu-diger", is_active: true },
          ],
        },
      })
      const [kitchen, mugs, other] = categories.map((category) => category.id)
      const filed = await stockedProduct(getContainer(), shop, "toplu-kategorili", 1)
      const loose = await stockedProduct(getContainer(), shop, "toplu-kategorisiz", 1)
      await updateProductsWorkflow(getContainer()).run({
        input: { selector: { id: filed.productId }, update: { category_ids: [kitchen ?? ""] } },
      })
      await setProductCatalogWorkflow(getContainer()).run({
        input: { product_id: filed.productId, primary_category_id: kitchen ?? null },
      })
      const fields = ["categories.id", "product_extension.primary_category_id"]
      const placed = async (id: string) => {
        const product = (await productOf(id, fields)) as {
          categories: { id: string }[]
          product_extension?: { primary_category_id: string | null } | null
        }
        return {
          categories: product.categories.map((category) => category.id).sort(),
          primary: product.product_extension?.primary_category_id ?? null,
        }
      }

      const made = await bulk([filed.productId, loose.productId], {
        action: "category",
        mode: "primary",
        category_id: mugs,
      })
      expect(made.result_summary).toMatchObject({ changed: 2, failed: 0 })
      expect(await placed(filed.productId)).toEqual({
        categories: [kitchen, mugs].sort(),
        primary: mugs,
      })
      expect(await placed(loose.productId)).toEqual({ categories: [mugs], primary: mugs })

      await bulk([filed.productId, loose.productId], {
        action: "category",
        mode: "remove",
        category_id: mugs,
      })
      // The primary category gone, the one left takes its place
      expect(await placed(filed.productId)).toEqual({ categories: [kitchen], primary: kitchen })
      expect(await placed(loose.productId)).toEqual({ categories: [], primary: null })

      // A failing later step puts the categories back (Medusa's step, by relation)
      await expect(
        bulkCategoryWorkflow(getContainer()).run({
          input: {
            product_id: filed.productId,
            category_ids: [kitchen ?? "", mugs ?? ""],
            primary_category_id: other ?? "",
          },
        })
      ).rejects.toBeTruthy()
      expect(await placed(filed.productId)).toEqual({ categories: [kitchen], primary: kitchen })

      const unknown = await bulk([filed.productId], {
        action: "category",
        mode: "add",
        category_id: "pcat_yok",
      })
      expect(unknown).toMatchObject({ status: "failed", error_code: "bulk_edit.category_unknown" })
    })

    it("gives SEO titles back to the template and fills missing alt texts", async () => {
      const { productId } = await stockedProduct(getContainer(), shop, "toplu-seo", 1)
      await upsertSeoMetaWorkflow(getContainer()).run({
        input: { entity_type: "product", entity_id: productId, values: { seo_title: "Özel" } },
      })
      const templated = await bulk([productId], { action: "seo_template", fields: ["seo_title"] })
      expect(templated.result_summary).toMatchObject({ changed: 1 })
      expect(await productOf(productId, ["seo_meta.seo_title"])).toMatchObject({
        seo_meta: { seo_title: null },
      })

      const { result } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: "Keten Gömlek",
              handle: "toplu-gomlek",
              status: "draft",
              shipping_profile_id: shop.shippingProfileId,
              images: [
                { url: "https://cdn.example.com/gomlek-1.jpg" },
                { url: "https://cdn.example.com/gomlek-2.jpg" },
              ],
              options: [{ title: "Renk", values: ["Beyaz", "Mavi"] }],
              variants: [
                { title: "Beyaz", options: { Renk: "Beyaz" }, prices: [] },
                { title: "Mavi", options: { Renk: "Mavi" }, prices: [] },
              ],
            },
          ],
        },
      })
      const shirt = result[0]
      const white = shirt?.variants.find((variant) => variant.title === "Beyaz")?.id ?? ""
      const second = shirt?.images.find((image) => image.url.endsWith("gomlek-2.jpg"))?.id ?? ""
      await batchImageVariantsWorkflow(getContainer()).run({
        input: { image_id: second, add: [white] },
      })
      // The images' records (added by URL) come from the product's event
      const media = getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await media.listMediaAssets({ url: { $like: "%gomlek-%" } })).length === 2) {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      const filled = await bulk([shirt?.id ?? ""], { action: "alt_text" })
      expect(filled.result_summary).toMatchObject({ changed: 1 })
      const assets = await media.listMediaAssets({ url: { $like: "%gomlek-%" } })
      expect(Object.fromEntries(assets.map((asset) => [asset.url.slice(-12), asset.alt]))).toEqual({
        "gomlek-1.jpg": "Keten Gömlek",
        "gomlek-2.jpg": "Keten Gömlek – Beyaz",
      })
      const again = await bulk([shirt?.id ?? ""], { action: "alt_text" })
      expect(again.result_summary).toMatchObject({ changed: 0, unchanged: 1 })
    })

    it("refuses input the job type does not take", async () => {
      const refused = await settle(
        http.post(
          "/admin/async-jobs",
          {
            type: "catalog.bulk_edit",
            input: {
              product_ids: ["prod_1"],
              change: { action: "price", mode: "percent", value: 0 },
            },
          },
          { headers: admin.headers }
        )
      )
      expect(refused.status).toBe(400)
      expect((refused.data as { message: string }).message).toBe("async_job.input_invalid")
    })
  },
})
