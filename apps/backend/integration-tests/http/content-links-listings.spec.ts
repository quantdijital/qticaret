import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { docHrefs } from "../../src/lib/content/links"
import type { ContentDoc } from "../../src/lib/content/doc"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop, stockedProduct } from "../helpers/stock"

jest.setTimeout(240 * 1000)

/** A listing description of one paragraph: its text, linked to `href`. */
const docOf = (text: string, href: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text, marks: [{ type: "link", attrs: { href } }] }],
    },
  ],
})

interface Described {
  description: string | null
  description_doc: ContentDoc | null
}

/**
 * adr/0075 + adr/0042 Ek 2026-11-05: categories', brands' and collections'
 * description documents join the link rewrite: a product whose handle
 * changed is linked at its new path after an apply, through each one's
 * own save (the plain text beside it unchanged); a dry run writes nothing.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    let oldHandle: string
    let newHandle: string
    let categoryId: string
    let brandId: string
    let collectionId: string

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: owner.headers }))
    const get = async <T>(url: string) => (await http.get<T>(url, { headers: owner.headers })).data
    const jobs = () => sheetClient(http, getContainer, () => owner.headers)
    const run = async (input: Record<string, unknown>) => {
      const queued = await post<{ async_job: SheetJob }>("/admin/async-jobs", {
        type: "content.link_rewrite",
        input,
      })
      expect(queued.status).toBe(202)
      const job = await jobs().settled(queued.data.async_job.id)
      expect(job.status).toBe("succeeded")
      return job
    }
    /** Each listing's links and plain text, as the panel reads them. */
    const listings = async () => {
      const category = (
        await get<{ description: Described }>(`/admin/category-descriptions/${categoryId}`)
      ).description
      const brand = (await get<{ brand: Described }>(`/admin/brands/${brandId}`)).brand
      const collection = (
        await get<{ collection: Described }>(`/admin/collection-board/${collectionId}`)
      ).collection
      return [category, brand, collection].map((each) => ({
        links: docHrefs(each.description_doc),
        text: each.description,
      }))
    }

    beforeEach(async () => {
      const container = getContainer()
      owner = await createAdminUser(http, container)
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      const shop = await stockShop(container)
      const stamp = String(Date.now())
      oldHandle = `kupa-${stamp}`
      newHandle = `seramik-kupa-${stamp}`
      const { productId } = await stockedProduct(container, shop, oldHandle, 5, 100)

      categoryId = (
        await post<{ product_category: { id: string } }>("/admin/product-categories", {
          name: `Kupalar ${stamp}`,
          is_active: true,
        })
      ).data.product_category.id
      const described = await post(`/admin/category-descriptions/${categoryId}`, {
        description_doc: docOf("Kupa", `/urun/${oldHandle}`),
      })
      expect(described.status).toBe(200)
      const brand = await post<{ brand: { id: string } }>("/admin/brands", {
        name: `Usta ${stamp}`,
        description_doc: docOf("Usta", `https://magaza.example.com/urun/${oldHandle}#bakim`),
      })
      expect(brand.status).toBe(201)
      brandId = brand.data.brand.id
      collectionId = (
        await post<{ collection: { id: string } }>("/admin/collections", { title: `Yaz ${stamp}` })
      ).data.collection.id
      const details = await post(`/admin/collections/${collectionId}/details`, {
        description_doc: docOf("Yaz", `/urun/${oldHandle}?renk=mavi`),
      })
      expect(details.status).toBe(200)

      // The product's handle changes: its old path answers with a 301 to the new one (adr/0017)
      const renamed = await post(`/admin/products/${productId}`, { handle: newHandle })
      expect(renamed.status).toBe(200)
    })

    it("checks, then points the listings' links at the product's new path through their saves", async () => {
      const before = await listings()
      const checked = await run({ dry_run: true })
      const unchanged = await listings()
      const applied = await run({})
      const after = await listings()
      const again = await run({})

      expect(before).toEqual([
        { links: [`/urun/${oldHandle}`], text: "Kupa" },
        { links: [`https://magaza.example.com/urun/${oldHandle}#bakim`], text: "Usta" },
        { links: [`/urun/${oldHandle}?renk=mavi`], text: "Yaz" },
      ])
      // The dry run writes nothing and counts what the apply does
      expect(unchanged).toEqual(before)
      expect(checked.result_summary).toMatchObject({
        dry_run: true,
        documents: 3,
        rewritten: 3,
        changed: 3,
        unresolved: 0,
      })
      expect(applied.result_summary).toMatchObject({
        dry_run: false,
        documents: 3,
        rewritten: 3,
        changed: 3,
        unresolved: 0,
      })
      // Each document rewritten, its plain text (the mirror) as it was
      expect(after).toEqual([
        { links: [`/urun/${newHandle}`], text: "Kupa" },
        { links: [`/urun/${newHandle}#bakim`], text: "Usta" },
        { links: [`/urun/${newHandle}?renk=mavi`], text: "Yaz" },
      ])
      // Nothing is left to change
      expect(again.result_summary).toMatchObject({ rewritten: 0, changed: 0, unresolved: 0 })
      expect((await jobs().fileBytes(applied)).length).toBeGreaterThan(0)
    })
  },
})
