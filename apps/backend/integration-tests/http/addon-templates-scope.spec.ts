import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(240 * 1000)

type Answer = { message?: string } & Record<string, unknown>
interface Template {
  id: string
  name: string
  addons: { id: string; label: string }[]
  product_count: number
}
interface Catalog {
  addon_templates: { id: string; via: string }[]
}

const ENGRAVING = {
  kind: "text",
  label: "Bıçağa isim kazıma",
  price: 150,
  non_withdrawable: true,
  text: { max_length: 30 },
}
const COVER = {
  kind: "choice",
  label: "Kılıf",
  choices: [{ label: "Siyah", price: 300 }],
}

let made = 0

/**
 * 2026-11-23: an add-on template applied where it is made — to every
 * product or to a category's (with those below it) — through the bulk
 * edit job's server-side scope, past the 1,000 the panel can name; a
 * product it would take past five add-ons is skipped and reported.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    const sheets = sheetClient(http, getContainer, () => admin.headers)

    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const read = <T>(url: string) => settle(http.get<T>(url, { headers: admin.headers }))
    const flag = (enabled: boolean) => staff("/admin/features/catalog.addons", { enabled })
    const product = () => stockedProduct(getContainer(), shop, `kapsam-${String((made += 1))}`, 5)
    const linkedTo = async (productId: string) =>
      (await read<Catalog>(`/admin/products/${productId}/catalog`)).data.addon_templates
        .filter((each) => each.via === "product")
        .map((each) => each.id)
    const template = async (id: string) =>
      (await read<{ addon_template: Template }>(`/admin/addon-templates/${id}`)).data.addon_template
    const category = async (name: string, parent?: string) =>
      (
        (
          await staff("/admin/product-categories", {
            name,
            is_active: true,
            ...(parent ? { parent_category_id: parent } : {}),
          })
        ).data["product_category"] as { id: string }
      ).id
    const run = async (input: Record<string, unknown>) => {
      const queued = await staff("/admin/async-jobs", { type: "catalog.bulk_edit", input })
      if (queued.status !== 202) {
        return { queued, done: null }
      }
      return {
        queued,
        done: await sheets.settled((queued.data["async_job"] as SheetJob).id),
      }
    }

    beforeEach(async () => {
      const container = getContainer()
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
    })
    afterEach(async () => {
      await flag(false)
    })

    it("saves an add-on as a template and links it to every product, skipping a full one", async () => {
      await flag(true)
      const first = await product()
      const second = await product()
      const full = await product()
      await staff(`/admin/products/${full.productId}/catalog`, {
        addons: Array.from({ length: 5 }, (_, index) => ({
          ...COVER,
          label: `Kılıf ${String(index)}`,
        })),
      })
      // What the product page's add-on dialog sends for "Şablon olarak kaydet ve uygula"
      const created = await staff("/admin/addon-templates", {
        name: ENGRAVING.label,
        addons: [ENGRAVING],
      })
      const saved = created.data["addon_template"] as Template
      const { queued, done } = await run({
        scope: { kind: "all" },
        change: { action: "addon_template", mode: "add", template_id: saved.id },
      })
      const report = done ? await sheets.fileOf(done) : []
      const usage = await template(saved.id)

      expect(created.status).toBe(200)
      expect(saved.name).toBe("Bıçağa isim kazıma")
      expect(queued.status).toBe(202)
      expect(done?.status).toBe("succeeded")
      expect(done?.result_summary).toMatchObject({
        action: "addon_template",
        products: 3,
        changed: 2,
        skipped: 1,
        failed: 0,
      })
      expect(await linkedTo(first.productId)).toEqual([saved.id])
      expect(await linkedTo(second.productId)).toEqual([saved.id])
      expect(await linkedTo(full.productId)).toEqual([])
      expect(usage.product_count).toBe(2)
      // The report names the product left out, and why
      const skippedRow = report.find((row) => row[2] === "Atlandı")
      expect(skippedRow?.[0]).toBe(`kapsam-${String(made)}`)
      expect(skippedRow?.[3]).toEqual(expect.any(String))

      // Run again: each is linked already, nothing changes
      const again = await run({
        scope: { kind: "all" },
        change: { action: "addon_template", mode: "add", template_id: saved.id },
      })
      expect(again.done?.result_summary).toMatchObject({ changed: 0, unchanged: 2, skipped: 1 })
    })

    it("applies and removes a template by category, with the ones below it", async () => {
      await flag(true)
      const knives = await category("Bıçaklar")
      const chef = await category("Şef bıçakları", knives)
      const boards = await category("Kesme tahtaları")
      const inKnives = await product()
      const inChef = await product()
      const inBoards = await product()
      await staff(`/admin/products/${inKnives.productId}`, { categories: [{ id: knives }] })
      await staff(`/admin/products/${inChef.productId}`, { categories: [{ id: chef }] })
      await staff(`/admin/products/${inBoards.productId}`, { categories: [{ id: boards }] })
      const saved = (await staff("/admin/addon-templates", { name: "Kazıma", addons: [ENGRAVING] }))
        .data["addon_template"] as Template

      const added = await run({
        scope: { kind: "category", category_id: knives },
        change: { action: "addon_template", mode: "add", template_id: saved.id },
      })
      const afterAdd = {
        knives: await linkedTo(inKnives.productId),
        chef: await linkedTo(inChef.productId),
        boards: await linkedTo(inBoards.productId),
        count: (await template(saved.id)).product_count,
      }
      // Removing needs no flag (adr/0052 Ek 2026-11-23 §6)
      await flag(false)
      const removed = await run({
        scope: { kind: "category", category_id: chef },
        change: { action: "addon_template", mode: "remove", template_id: saved.id },
      })
      const afterRemove = {
        knives: await linkedTo(inKnives.productId),
        chef: await linkedTo(inChef.productId),
        count: (await template(saved.id)).product_count,
      }

      expect(added.done?.result_summary).toMatchObject({ products: 2, changed: 2, skipped: 0 })
      expect(afterAdd).toEqual({ knives: [saved.id], chef: [saved.id], boards: [], count: 2 })
      expect(removed.done?.result_summary).toMatchObject({ products: 1, changed: 1 })
      expect(afterRemove).toEqual({ knives: [saved.id], chef: [], count: 1 })
    })

    it("refuses a scope for another change, beside named products, or a category that is gone", async () => {
      await flag(true)
      const p = await product()
      const saved = (await staff("/admin/addon-templates", { name: "Kazıma", addons: [ENGRAVING] }))
        .data["addon_template"] as Template
      const otherChange = await run({
        scope: { kind: "all" },
        change: { action: "status", status: "draft" },
      })
      const both = await run({
        product_ids: [p.productId],
        scope: { kind: "all" },
        change: { action: "addon_template", mode: "add", template_id: saved.id },
      })
      const gone = await run({
        scope: { kind: "category", category_id: "pcat_yok" },
        change: { action: "addon_template", mode: "add", template_id: saved.id },
      })

      expect(otherChange.queued.status).toBe(400)
      expect(both.queued.status).toBe(400)
      expect(gone.done?.status).toBe("failed")
      expect(gone.done?.error_code).toBe("bulk_edit.category_unknown")
      expect(await linkedTo(p.productId)).toEqual([])
    })

    it("stops a scoped link at once while add-ons are off", async () => {
      await flag(true)
      const p = await product()
      const saved = (await staff("/admin/addon-templates", { name: "Kazıma", addons: [ENGRAVING] }))
        .data["addon_template"] as Template
      await flag(false)
      const { done } = await run({
        scope: { kind: "all" },
        change: { action: "addon_template", mode: "add", template_id: saved.id },
      })

      expect(done?.status).toBe("failed")
      expect(done?.error_code).toBe("catalog.addons_disabled")
      expect(await linkedTo(p.productId)).toEqual([])
    })
  },
})
