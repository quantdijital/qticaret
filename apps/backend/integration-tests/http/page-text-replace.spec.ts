import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { importPage, importPageWorkflow } from "../../src/workflows/migration/content-page"
import { layoutRow } from "../../src/workflows/storefront/layout-row"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { pageTextRefusal, writePageText } from "../helpers/pages"

jest.setTimeout(180 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }
interface Stored {
  pages?: { page_id: string; sections: Section[] }[]
}

const paragraph = (value: string) => ({
  type: "paragraph",
  content: [{ type: "text", text: value }],
})
const doc = (...values: string[]) => ({ type: "doc", content: values.map(paragraph) })
const help = (id: string) => ({ id, type: "help", title: "Hangi bıçak size uygun?" })
const sectionsOf = (stored: unknown, pageId: string) =>
  (stored as Stored).pages?.find((page) => page.page_id === pageId)?.sections ?? null

/**
 * adr/0073 Ek 2026-11-19 (2) K4: a content page's text replaced by the
 * system (`replacePageTextWorkflow`: an import from the old site, the shop
 * profile), checked as a page's text: into its first text section in the
 * draft and the live design (a system revision), else an entry made where
 * there is room, then its `body` mirror. The same text again writes
 * nothing.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("writes a page's text into its sections and its mirror, and nothing when it is the same", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      const content = container.resolve<ContentModuleService>(CONTENT_MODULE)
      const page = async (title: string, kind: "page" | "post" = "page") =>
        (
          await settle(
            http.post<{ entry: { id: string } }>(
              "/admin/content",
              { kind, title, status: "published" },
              asOwner
            )
          )
        ).data.entry.id
      const about = await page("Hakkımızda")
      const contact = await page("İletişim")
      const post = await page("Duyuru", "post")
      const bodyOf = async (id: string) =>
        (await content.listContentEntries({ id }, { select: ["body"] }))[0]?.body

      // No design yet: the mirror alone, the store read makes the sections from it (K1)
      expect(await writePageText(container, about, doc("Biz kimiz."))).toEqual({
        page_id: about,
        mirrored: true,
        live: false,
      })
      expect(await bodyOf(about)).toEqual(doc("Biz kimiz."))
      expect(await layoutRow(container)).toBeNull()

      // A live design laying the pages out
      await settle(
        http.post("/admin/platform-settings/storefront", { contact_page_id: contact }, asOwner)
      )
      const pages = [
        {
          page_id: about,
          sections: [
            help("yardim001"),
            { id: "metin00001", type: "rich_text", variant: "article", body: doc("Biz kimiz.") },
            {
              id: "ikinci0001",
              type: "rich_text",
              variant: "article",
              title: "Ayrıca",
              body: doc("İkinci metin."),
            },
          ],
        },
        {
          page_id: contact,
          sections: [{ id: "iletisim01", type: "contact", body: doc("Yazın.") }],
        },
      ]
      await settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [], pages } },
          asOwner
        )
      )
      await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))
      const before = await layoutRow(container)

      const replaced = await writePageText(container, about, doc("Yeni metin."))
      expect(replaced).toEqual({ page_id: about, mirrored: true, live: true })
      const row = await layoutRow(container)
      // Its first article's text, in the draft and live alike; the rest as it was
      for (const stored of [row?.draft, row?.published]) {
        const sections = sectionsOf(stored, about)
        expect(sections?.map((section) => section.id)).toEqual([
          "yardim001",
          "metin00001",
          "ikinci0001",
        ])
        expect(sections?.[1]?.["body"]).toEqual(doc("Yeni metin."))
        expect(sections?.[2]?.["body"]).toEqual(doc("İkinci metin."))
      }
      // A system revision: the next, by no one
      expect(row?.revision).toBe((before?.revision ?? 0) + 1)
      expect(row?.published_by).toBeNull()
      // The mirror is the live text sections', the titled one's title as an h2
      expect(await bodyOf(about)).toEqual({
        type: "doc",
        content: [
          paragraph("Yeni metin."),
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Ayrıca" }] },
          paragraph("İkinci metin."),
        ],
      })

      // Recorded as the system's: why, the page by id, the revision; never its text or title
      const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const writes = () => audit.listAuditEntries({ action: "storefront.layout_system_write" })
      const [recorded] = await writes()
      expect(recorded).toMatchObject({
        kind: "system",
        actor_type: "system",
        resource_type: "storefront_layout",
        resource_id: row?.id,
        changes: { reason: "import", revision: row?.revision, pages: [about] },
      })
      expect(JSON.stringify(recorded?.changes)).not.toContain("Yeni metin")

      // The same text again (an import run twice): nothing written, no revision, no record
      expect(await writePageText(container, about, doc("Yeni metin."))).toEqual({
        page_id: about,
        mirrored: false,
        live: false,
      })
      expect((await layoutRow(container))?.revision).toBe(row?.revision)
      expect(await writes()).toHaveLength(1)

      // The contact page's text is its contact section's
      await writePageText(container, contact, doc("Bize her gün yazın."))
      const contactNow = sectionsOf((await layoutRow(container))?.published, contact)
      expect(contactNow?.map((section) => section.type)).toEqual(["contact"])
      expect(contactNow?.[0]?.["body"]).toEqual(doc("Bize her gün yazın."))
      expect(await bodyOf(contact)).toEqual(doc("Bize her gün yazın."))

      // A page with no entry: one made with its text (there is room)
      const fresh = await page("Yeni sayfa")
      await writePageText(container, fresh, doc("Yepyeni."))
      const freshNow = sectionsOf((await layoutRow(container))?.published, fresh)
      expect(freshNow?.map((section) => [section.type, section["variant"]])).toEqual([
        ["rich_text", "article"],
      ])
      expect(await bodyOf(fresh)).toEqual(doc("Yepyeni."))

      // Checked as a page's text; a post is no page; a refusal writes nothing
      const settled = await layoutRow(container)
      const missing = { type: "productCard", attrs: { id: `prod_${"01KYOK".padEnd(26, "0")}` } }
      expect(
        await pageTextRefusal(container, about, { type: "doc", content: [missing] })
      ).toContain("content.card_unknown")
      expect(await pageTextRefusal(container, about, doc("{uydurma}"))).toContain(
        "content.token_unknown"
      )
      expect(
        await pageTextRefusal(container, about, {
          type: "doc",
          content: [{ type: "image", attrs: { src: "https://evil.example/x.png" } }],
        })
      ).toContain("content.image_unknown")
      expect(await pageTextRefusal(container, post, doc("Yazı."))).toContain("content.unknown")
      const unchanged = await layoutRow(container)
      expect(unchanged?.revision).toBe(settled?.revision)
      expect(unchanged?.draft).toEqual(settled?.draft)
      expect((await bodyOf(about))?.["content"]).toContainEqual(paragraph("Yeni metin."))
      expect(await bodyOf(post)).toEqual({ type: "doc", content: [] })
    })

    it("makes no page from an import whose text is refused or cannot be written", async () => {
      const container = getContainer()
      const content = container.resolve<ContentModuleService>(CONTENT_MODULE)
      const handled = (handle: string) =>
        content.listContentEntries({ kind: "page", handle }, { select: ["id"] })
      const values = (handle: string) => ({
        title: "Eski sayfa",
        handle,
        status: "published" as const,
        excerpt: null,
        author_name: null,
        image_url: null,
        image_alt: null,
      })

      // An image the shop never uploaded: refused before the page is made
      const outside = { type: "image", attrs: { src: "https://evil.example/x.png" } }
      await expect(
        importPage(container, values("resimli"), { type: "doc", content: [outside] })
      ).rejects.toThrow("content.image_unknown")
      expect(await handled("resimli")).toEqual([])

      // The text refused inside the workflow, after the page was saved (no check before it):
      // the page's save is undone, its address free again
      const missing = {
        type: "productCard" as const,
        attrs: { id: `prod_${"01KYOK".padEnd(26, "0")}` },
      }
      const { errors } = await importPageWorkflow(container).run({
        input: { page: values("kartli"), doc: { type: "doc", content: [missing] } },
        throwOnError: false,
      })
      expect(errors.length).toBeGreaterThan(0)
      expect(await handled("kartli")).toEqual([])
      const again = await importPage(container, values("kartli"), doc("Kartsız."))
      const [freed] = await content.listContentEntries({ id: again }, { select: ["handle"] })
      expect(freed?.handle).toBe("kartli")

      // Written: the page and its text together
      const id = await importPage(container, values("yazili"), doc("Metin."))
      const [page] = await content.listContentEntries(
        { id },
        { select: ["status", "body", "handle"] }
      )
      expect(page).toMatchObject({ status: "published", handle: "yazili", body: doc("Metin.") })

      // The design's lock held past its wait: nothing made at all
      const locking = container.resolve(Modules.LOCKING)
      await locking.acquire("storefront-layout", { ownerId: "test-editor", expire: 60 })
      try {
        const failed = await importPage(container, values("kilitli"), doc("Metin.")).then(
          () => null,
          (error: unknown) => error
        )
        expect(failed).not.toBeNull()
      } finally {
        await locking.release("storefront-layout", { ownerId: "test-editor" })
      }
      expect(await handled("kilitli")).toEqual([])
    })
  },
})
