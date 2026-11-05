import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { readXlsx } from "../../src/lib/sheets"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { CATALOG_ENTITY_TYPES } from "../../src/workflows/catalog/entity-paths"
import { advisorFacts } from "../../src/workflows/seo/advisor/facts"
import { seoPayloadFor } from "../../src/workflows/seo/payload"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { among, searchKit } from "../helpers/search"
import type { SearchKit } from "../helpers/search"
import { at, row, sheetClient, xlsxOf } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockedProduct } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(300 * 1000)

const text = (value: string, marks?: unknown[]) => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
})
const doc = (...content: unknown[]) => ({ type: "doc", content })

// Bold and a list: what a sheet's plain text does not carry
const RICH = doc(
  {
    type: "paragraph",
    content: [text("Sedefli düğmeli, "), text("yıkanmış", [{ type: "bold" }]), text(" keten")],
  },
  {
    type: "bulletList",
    content: [
      { type: "listItem", content: [{ type: "paragraph", content: [text("Rahat kesim")] }] },
    ],
  }
)
const RICH_TEXT = "Sedefli düğmeli, yıkanmış keten. Rahat kesim."

interface FeedsStatus {
  targets: { target: string; url: string | null }[]
}

/**
 * adr/0055 Ek 2026-11-06: a product's short description where the shop
 * did not write it again: search finds it below the title, the feeds
 * and the meta description stand it in for a missing text, the advisor
 * reads that stand-in, and the catalogue sheet carries it as plain text.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: SearchKit
    let admin: { headers: Record<string, string> }
    const sheets = sheetClient(http, getContainer, () => admin.headers)

    const save = (id: string, summary: unknown) =>
      settle(
        http.post<{ summary_doc: unknown }>(
          `/admin/products/${id}/catalog`,
          { summary_doc: summary },
          { headers: admin.headers }
        )
      )
    const summaryOf = async (id: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product", fields: ["product_extension.summary_doc"], filters: { id } })
      return (data[0] as { product_extension?: { summary_doc?: unknown } | null } | undefined)
        ?.product_extension?.summary_doc
    }
    const searched = (q: string, ids: string[], count: number) =>
      eventually(
        async () => among((await kit.search(q, {}, { indexed: false })).data, ids),
        (found) => found.length === count
      )

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      kit = await searchKit(http, container)
      admin = await createAdminUser(http, container)
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    it("finds a product by its short description once saved, below one named so", async () => {
      const named = await kit.product({ title: "Sedefli Kutu" })
      const introduced = await kit.product({ title: "Keten Gömlek" })
      const described = await kit.product({ title: "Pamuk Gömlek", description: "Sedefli yaka" })
      const ids = [named, introduced, described]
      expect(await searched("sedefli", ids, 2)).toEqual([named, described])

      // Saved through the catalogue path: its event marks the product to be indexed again
      expect((await save(introduced, RICH)).status).toBe(200)
      // Title (A) over short description (C) over description (D)
      expect(await searched("sedefli", ids, 3)).toEqual([named, introduced, described])
      expect(await searched("rahat", ids, 1)).toEqual([introduced])

      await save(introduced, null)
      expect(await searched("rahat", ids, 0)).toEqual([])
    })

    it("stands in for a missing description in the feeds, and in what the advisor reads", async () => {
      const container = getContainer()
      const handle = `ozetli-${String(Date.now())}`
      const { productId } = await stockedProduct(container, kit.shop, handle, 5, 249.9)
      await container
        .resolve(Modules.PRODUCT)
        .updateProducts(productId, { images: [{ url: "https://cdn.example.com/ozet.jpg" }] })
      await save(productId, RICH)

      await http.post("/admin/marketing-feeds/token", {}, { headers: admin.headers })
      await http.post("/admin/marketing-feeds/generate", {}, { headers: admin.headers })
      const { data } = await http.get<{ feeds: FeedsStatus }>("/admin/marketing-feeds", {
        headers: admin.headers,
      })
      const feed = async (target: string) => {
        const url = data.feeds.targets.find((each) => each.target === target)?.url ?? ""
        return (await settle(http.get<string>(new URL(url).pathname, { responseType: "text" })))
          .data
      }
      const item = (xml: string, open: string, close: string) =>
        xml
          .split(open)
          .find((each) => each.includes(handle))
          ?.split(close)[0] ?? ""

      const google = item(await feed("google"), "<item>", "</item>")
      const akakce = item(await feed("akakce"), "<product>", "</product>")
      const meta = (await feed("meta")).split("\n").find((line) => line.includes(handle)) ?? ""
      expect(google).toContain(`<g:description>${RICH_TEXT}</g:description>`)
      expect(akakce).toContain(`<description>${RICH_TEXT}</description>`)
      expect(meta).toContain(`"${RICH_TEXT}"`)

      // The advisor judges the meta description the page shows: the short description's
      const owner = { entity_type: CATALOG_ENTITY_TYPES.product, entity_id: productId }
      const path = `/urun/${handle}`
      const seo = await seoPayloadFor(container, owner, path)
      const facts = await advisorFacts(container, "product", productId)
      expect(seo?.description.startsWith("Sedefli düğmeli, yıkanmış keten. Rahat kesim")).toBe(true)
      expect(facts?.description).toBe(seo?.description)
      expect(facts?.product?.summary).toBe(RICH_TEXT.length)
    })

    it("exports the short description as plain text and imports plain text as a paragraph", async () => {
      const container = getContainer()
      const { productId } = await stockedProduct(container, kit.shop, "ozet-tablo", 3)
      await save(productId, RICH)

      const queued = await http.post<{ async_job: SheetJob }>(
        "/admin/async-jobs",
        { type: "catalog.export", input: { format: "xlsx" } },
        { headers: admin.headers }
      )
      const exported = await sheets.settled(queued.data.async_job.id)
      const file = await sheets.fileBytes(exported)
      const raw = await readXlsx(file, { maxRows: 10_000, maxCells: 200 })
      const cells = raw.ok
        ? raw.rows.find((each) => each.cells[at("handle")] === "ozet-tablo")?.cells
        : []
      expect(cells?.[at("summary")]).toBe(RICH_TEXT)

      // Uploaded as it is: nothing changes, the bold and the list stay
      const again = await sheets.upload(file, "apply")
      expect(again.result_summary).toMatchObject({ update: 0, problems: 0, failed: 0 })
      expect(await summaryOf(productId)).toEqual(RICH)

      const applied = await sheets.upload(
        await xlsxOf([
          row({ handle: "ozet-tablo", summary: "Elde dikildi\nKuru temizleme" }),
          row({ handle: "ozet-yeni", title: "Özet Yeni", price: 50, summary: "Tek satır" }),
        ]),
        "apply"
      )
      expect(applied.result_summary).toMatchObject({ create: 1, update: 1, failed: 0 })
      expect(await summaryOf(productId)).toEqual(
        doc({
          type: "paragraph",
          content: [text("Elde dikildi"), { type: "hardBreak" }, text("Kuru temizleme")],
        })
      )
      const { data } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product", fields: ["id"], filters: { handle: "ozet-yeni" } })
      const created = (data[0] as { id: string } | undefined)?.id ?? ""
      expect(await summaryOf(created)).toEqual(
        doc({ type: "paragraph", content: [text("Tek satır")] })
      )
    })
  },
})
