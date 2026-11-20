import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { docHrefs } from "../../src/lib/content/links"
import type { ContentDoc } from "../../src/lib/content/doc"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { writePageText } from "../helpers/pages"
import { readStoredLayout } from "../../src/lib/storefront/layout"
import { layoutRow } from "../../src/workflows/storefront/layout-row"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop, stockedProduct } from "../helpers/stock"

jest.setTimeout(240 * 1000)

const linked = (text: string, href: string) => ({
  type: "text",
  text,
  marks: [{ type: "link", attrs: { href } }],
})
const paragraphOf = (...content: unknown[]) => ({ type: "paragraph", content })

interface Summary {
  dry_run: boolean
  documents: number
  rewritten: number
  changed: number
  unresolved: number
}

/**
 * adr/0042 Ek 2026-11-05: the texts' links to the shop and its old site
 * pointed at the pages that answer them today, by a job owner and admin
 * queue; links elsewhere untouched, the unanswered reported.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    let handle: string
    let productId: string
    let pageId: string

    const jobs = () => sheetClient(http, getContainer, () => owner.headers)
    const queue = (input: Record<string, unknown>, headers = owner.headers) =>
      settle(
        http.post<{ async_job: SheetJob; message?: string }>(
          "/admin/async-jobs",
          { type: "content.link_rewrite", input },
          { headers }
        )
      )
    const run = async (input: Record<string, unknown>) => {
      const queued = await queue(input)
      expect(queued.status).toBe(202)
      const job = await jobs().settled(queued.data.async_job.id)
      expect(job.status).toBe("succeeded")
      return job
    }
    const pageLinks = async () => {
      const [page] = await getContainer()
        .resolve<ContentModuleService>(CONTENT_MODULE)
        .listContentEntries({ id: pageId }, { select: ["body"] })
      return docHrefs(page?.body as unknown as ContentDoc)
    }
    /** The links of the page's text sections in the draft and in the live design. */
    const layoutLinks = async () => {
      const row = await layoutRow(getContainer())
      const linksIn = (stored: unknown) =>
        readStoredLayout(stored)
          .pages.find((each) => each.page_id === pageId)
          ?.sections.flatMap((section) =>
            section.type === "rich_text" || section.type === "contact" ? docHrefs(section.body) : []
          ) ?? null
      return { draft: linksIn(row?.draft), live: linksIn(row?.published) }
    }
    const productLinks = async () => {
      const { data } = await http.get<{ description_doc: ContentDoc | null }>(
        `/admin/products/${productId}/catalog`,
        { headers: owner.headers }
      )
      return docHrefs(data.description_doc)
    }

    beforeEach(async () => {
      const container = getContainer()
      owner = await createAdminUser(http, container)
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      const shop = await stockShop(container)
      handle = `kupa-${String(Date.now())}`
      ;({ productId } = await stockedProduct(container, shop, handle, 5, 100))
      const rule = (body: Record<string, unknown>) =>
        http.post("/admin/seo/redirects", body, { headers: owner.headers })
      // The old site's address of the product, and a page the shop removed for good
      await rule({ source: "/eski-kupa", target: `/urun/${handle}` })
      await rule({ source: "/kaldirilan-sayfa", status: 410 })
      const made = await http.post<{ entry: { id: string } }>(
        "/admin/content",
        { kind: "page", title: "Kupa rehberi", status: "published" },
        { headers: owner.headers }
      )
      pageId = made.data.entry.id
      // A live design: the page's text is its sections' in the draft and the live design
      // (adr/0073 Ek 2026-11-19 (2) K4, K7), its `body` their mirror
      const design = { header: [], home: [], footer: [], pages: [] }
      await http.post("/admin/storefront-layout", { document: design }, { headers: owner.headers })
      await http.post("/admin/storefront-layout/publish", {}, { headers: owner.headers })
      await writePageText(container, pageId, {
        type: "doc",
        content: [
          paragraphOf(
            linked("eski adres", "/eski-kupa/"),
            linked("tam adres", `https://www.magaza.example.com/urun/${handle}?renk=mavi`),
            linked("dışarısı", "https://example.org/eski-kupa"),
            linked("kaldırılan", "/kaldirilan-sayfa"),
            linked("hiç olmayan", "/hic-olmayan-sayfa"),
            linked("sepet", "/sepet"),
            linked("ürün", `/urun/${handle}`)
          ),
        ],
      })
      await http.post(
        `/admin/products/${productId}/catalog`,
        {
          description_doc: {
            type: "doc",
            content: [paragraphOf(linked("eski", "https://magaza.example.com/eski-kupa#bakim"))],
          },
        },
        { headers: owner.headers }
      )
    })

    it("checks, then points the shop's own links at the pages that answer them, and reports the rest", async () => {
      const before = await pageLinks()
      const checked = await run({ dry_run: true })
      const unchanged = await pageLinks()

      const unchangedLayout = await layoutLinks()

      const applied = await run({})
      const page = await pageLinks()
      const layout = await layoutLinks()
      const product = await productLinks()
      const again = await run({})
      const [entry] = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ action: "content.links_rewritten", resource_id: applied.id })
      const report = await jobs().fileBytes(applied)

      // The dry run writes nothing and counts what an apply does
      expect(unchanged).toEqual(before)
      expect(checked.result_summary).toMatchObject({
        dry_run: true,
        rewritten: 2,
        changed: 3,
        unresolved: 2,
      } satisfies Partial<Summary>)
      expect(applied.result_summary).toMatchObject({
        dry_run: false,
        rewritten: 2,
        changed: 3,
        unresolved: 2,
      })
      expect(page).toEqual([
        `/urun/${handle}`,
        `/urun/${handle}?renk=mavi`,
        // Never a link elsewhere, never a page that answers nothing
        "https://example.org/eski-kupa",
        "/kaldirilan-sayfa",
        "/hic-olmayan-sayfa",
        "/sepet",
      ])
      // The page's text sections changed alike, in the draft and live (adr/0073 Ek 2026-11-19 (2) K7)
      expect(unchangedLayout).toEqual({ draft: before, live: before })
      expect(layout).toEqual({ draft: page, live: page })
      // The system's write to the live design recorded: the page by id and the revision only
      const writes = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ action: "storefront.layout_system_write" })
      const rewrite = writes.find((each) => each.changes?.["reason"] === "link_rewrite")
      expect(rewrite).toMatchObject({
        kind: "system",
        actor_type: "system",
        resource_type: "storefront_layout",
        changes: { reason: "link_rewrite", pages: [pageId] },
      })
      expect(rewrite?.changes?.["revision"]).toEqual(expect.any(Number))
      // The dry run and the run with nothing left to change: no record of their own
      expect(writes.filter((each) => each.changes?.["reason"] === "link_rewrite")).toHaveLength(1)
      expect(product).toEqual([`/urun/${handle}#bakim`])
      // Run again, nothing is left to change; the unanswered are still reported
      expect(again.result_summary).toMatchObject({ rewritten: 0, changed: 0, unresolved: 2 })
      expect(entry?.changes).toMatchObject({ changed: 3, unresolved: 2 })
      expect(report.length).toBeGreaterThan(0)
    })

    it("is the owner's and the admin's: operations and read-only are refused, the input checked", async () => {
      const container = getContainer()
      const admin = await createAdminUser(http, container, "admin")
      const operations = await createAdminUser(http, container, "operations")
      const readonly = await createAdminUser(http, container, "readonly")

      const byAdmin = await queue({ dry_run: true }, admin.headers)
      const byOperations = await queue({ dry_run: true }, operations.headers)
      const byReadonly = await queue({ dry_run: true }, readonly.headers)
      const wrongHost = await queue({ hosts: ["https://eski.example.com"] })

      expect(byAdmin.status).toBe(202)
      await jobs().settled(byAdmin.data.async_job.id)
      expect([byOperations.status, byReadonly.status]).toEqual([403, 403])
      expect(wrongHost.status).toBe(400)
    })
  },
})
