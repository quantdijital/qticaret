import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { movePageTexts } from "../../src/workflows/storefront/page-convert"
import { layoutRow, layouts } from "../../src/workflows/storefront/layout-row"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { writePageText } from "../helpers/pages"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }
interface Entry {
  page_id: string
  sections: Section[]
}
type Stored = Record<string, unknown> & { pages?: Entry[] }

const doc = (value: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
})
const help = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "help",
  title: "Hangi bıçak size uygun?",
  ...more,
})
/** A section's kind, as the assertions read it. */
const kindOf = (section: Section) =>
  section.type === "rich_text" ? `rich_text:${String(section["variant"])}` : section.type
const kinds = (doc: Stored, pageId: string) =>
  doc.pages?.find((page) => page.page_id === pageId)?.sections.map(kindOf) ?? null
const entryOf = (doc: Stored, pageId: string) =>
  doc.pages?.find((page) => page.page_id === pageId) ?? null

/**
 * adr/0073 Ek 2026-11-19 (2) K3: the content pages' texts moved once into
 * the theme editor's design (`movePageTexts`, run by `db:migrate` from
 * S8): each page's text becomes its sections by its role, an older entry
 * takes them where its text stood, the draft and the live design alike
 * (the live one as a system revision, recorded); twice gives the same
 * design; past the group's room a page is left to its mirror.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("moves each page's text into its sections by its role, once, into the draft and live", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const page = async (title: string, status: "published" | "draft" = "published") =>
        (
          await settle(
            http.post<{ entry: { id: string } }>(
              "/admin/content",
              { kind: "page", title, status },
              asOwner
            )
          )
        ).data.entry.id
      const about = await page("Hakkımızda")
      const faq = await page("Sıkça sorulan sorular")
      const contact = await page("İletişim")
      const payment = await page("Ödeme seçenekleri")
      const shipping = await page("Kargo")
      const empty = await page("Boş sayfa")
      const draft = await page("Yeni sayfa", "draft")
      const post = (
        await settle(
          http.post<{ entry: { id: string } }>(
            "/admin/content",
            { kind: "post", title: "Bıçak bakımı", body: doc("Yağlayın.") },
            asOwner
          )
        )
      ).data.entry.id
      const roles = await settle(
        http.post(
          "/admin/platform-settings/storefront",
          { contact_page_id: contact, payment_page_id: payment, shipping_page_id: shipping },
          asOwner
        )
      )
      expect(roles.status).toBe(200)
      // The texts as pages kept them before (no design yet: their `body` alone)
      for (const [id, text] of [
        [about, "Atölyemiz Denizli'de."],
        [faq, "Kargo ne zaman gelir?"],
        [contact, "Bize yazın."],
        [payment, "Kartla ya da havaleyle."],
        [shipping, "Üç iş gününde."],
        [draft, "Henüz yayında değil."],
      ] as const) {
        await writePageText(container, id, doc(text))
      }
      // A card whose product went since: the conversion moves it as it is (drawn without it)
      const gone = { type: "productCard", attrs: { id: `prod_${"01KGONE".padEnd(26, "0")}` } }
      const content = container.resolve<ContentModuleService>(CONTENT_MODULE)
      await content.updateContentEntries({
        id: faq,
        body: { type: "doc", content: [...doc("Kargo ne zaman gelir?").content, gone] },
      })

      // A design from before a page's text was a section: Hakkımızda laid out above and below
      const design = { header: [], home: [], footer: [], pages: [] }
      await settle(http.post("/admin/storefront-layout", { document: design }, asOwner))
      await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))
      const made = await layoutRow(container)
      if (!made) {
        throw new Error("no design")
      }
      const older: Entry = {
        page_id: about,
        sections: [
          help("ustyardim1", { placement: "top" }),
          help("altyardim1", { placement: "bottom" }),
        ],
      }
      await layouts(container).updateStorefrontLayouts({
        id: made.id,
        draft: { ...(made.draft as Stored), pages: [older] },
        published: { ...(made.published as Stored), pages: [older] },
      })
      const [before] = await content.listContentEntries(
        { id: about },
        { select: ["updated_at", "revised_at"] }
      )

      const moved = await movePageTexts(container)
      const row = await layoutRow(container)
      if (!row) {
        throw new Error("no design")
      }
      const draftDoc = row.draft as Stored
      const liveDoc = row.published as Stored

      // Each page by its role (K3's table); the empty page and the post get none
      for (const stored of [draftDoc, liveDoc]) {
        expect(kinds(stored, about)).toEqual(["help", "rich_text:article", "help"])
        expect(kinds(stored, faq)).toEqual(["rich_text:article"])
        expect(kinds(stored, contact)).toEqual(["contact"])
        expect(kinds(stored, payment)).toEqual(["rich_text:article", "payment_facts"])
        expect(kinds(stored, shipping)).toEqual(["rich_text:article", "shipping_facts"])
        expect(kinds(stored, draft)).toEqual(["rich_text:article"])
        expect(kinds(stored, empty)).toBeNull()
        expect(kinds(stored, post)).toBeNull()
        expect(entryOf(stored, about)?.sections[0]).not.toHaveProperty("placement")
        expect(entryOf(stored, about)?.sections[1]?.["body"]).toEqual(doc("Atölyemiz Denizli'de."))
        expect(entryOf(stored, contact)?.sections[0]?.["body"]).toEqual(doc("Bize yazın."))
        expect(
          (entryOf(stored, faq)?.sections[0]?.["body"] as { content: unknown[] }).content
        ).toEqual(expect.arrayContaining([gone]))
      }
      // The same ids in both: made from the page's
      expect(entryOf(draftDoc, about)?.sections.map((s) => s.id)).toEqual(
        entryOf(liveDoc, about)?.sections.map((s) => s.id)
      )
      expect(moved).toMatchObject({ converted: 6, left: 0, dropped: 0, live: true })
      expect(moved.bytes).toBeGreaterThan(0)

      // The live design changed as a system revision (no author), recorded with counts only
      expect(row.revision).toBe(made.revision + 1)
      expect(row.published_by).toBeNull()
      const [revision] = await layouts(container).listStorefrontLayoutRevisions(
        { revision: row.revision },
        { select: ["revision", "published_by"] }
      )
      expect(revision).toMatchObject({ revision: row.revision, published_by: null })
      const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const recorded = await audit.listAuditEntries({ action: "storefront.pages_converted" })
      expect(recorded).toHaveLength(1)
      expect(recorded[0]).toMatchObject({ actor_type: "system", resource_id: row.id })
      expect(recorded[0]?.changes).toEqual({ converted: 6, left: 0, live: true })
      // A page's text is no change of the page: its `body` (the mirror) is not written
      const [after] = await content.listContentEntries(
        { id: about },
        { select: ["updated_at", "revised_at"] }
      )
      expect(after?.updated_at).toEqual(before?.updated_at)
      expect(after?.revised_at).toEqual(before?.revised_at)

      // The live page shows its text where it stood, as one list
      const read = await settle(
        http.get<{ page: { synthesized?: true; sections: Section[] } | null }>(
          `/store/storefront-layout/pages/${about}`,
          { headers: store.headers }
        )
      )
      expect(read.data.page?.sections.map(kindOf)).toEqual(["help", "rich_text:article", "help"])
      expect(read.data.page).not.toHaveProperty("synthesized")

      // Run again: nothing moves, nothing is written or recorded
      const again = await movePageTexts(container)
      expect(again).toMatchObject({ converted: 0, left: 0, live: false })
      const still = await layoutRow(container)
      expect(still?.revision).toBe(row.revision)
      expect(still?.draft).toEqual(row.draft)
      expect(still?.published).toEqual(row.published)
      expect(await audit.listAuditEntries({ action: "storefront.pages_converted" })).toHaveLength(1)
    })

    it("leaves the pages past the design's room to their mirror, in the order they went live", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const livePage = async (title: string) => {
        const id = (
          await settle(
            http.post<{ entry: { id: string } }>(
              "/admin/content",
              { kind: "page", title, status: "published" },
              asOwner
            )
          )
        ).data.entry.id
        await writePageText(container, id, doc(`${title} metni.`))
        return id
      }
      const first = await livePage("Birinci")
      const second = await livePage("İkinci")
      const third = await livePage("Üçüncü")
      // Forty-eight entries already: room for two more pages
      const others: Entry[] = Array.from({ length: 48 }, (_, index) => ({
        page_id: `cnt_01KOTHER${String(index).padStart(17, "0")}`,
        sections: [help(`digeryardim${String(index)}`)],
      }))
      const design = { header: [], home: [], footer: [], pages: [] }
      await settle(http.post("/admin/storefront-layout", { document: design }, asOwner))
      await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))
      const made = await layoutRow(container)
      if (!made) {
        throw new Error("no design")
      }
      await layouts(container).updateStorefrontLayouts({
        id: made.id,
        draft: { ...(made.draft as Stored), pages: others },
        published: { ...(made.published as Stored), pages: others },
      })

      // Warn, don't block: the first two pages to go live get an entry, the third is left
      const moved = await movePageTexts(container)
      expect(moved).toMatchObject({ converted: 2, left: 1 })
      const row = await layoutRow(container)
      const live = row?.published as Stored
      expect(live.pages).toHaveLength(50)
      expect(kinds(live, first)).toEqual(["rich_text:article"])
      expect(kinds(live, second)).toEqual(["rich_text:article"])
      expect(kinds(live, third)).toBeNull()

      // The page left out is drawn from its mirror (K1)
      const read = await settle(
        http.get<{ page: { synthesized?: true; sections: Section[] } | null }>(
          `/store/storefront-layout/pages/${third}`,
          { headers: store.headers }
        )
      )
      expect(read.data.page).toMatchObject({ page_id: third, synthesized: true })
      expect(read.data.page?.sections.map(kindOf)).toEqual(["rich_text:article"])
      expect(read.data.page?.sections[0]?.["html"]).toContain("Üçüncü metni.")
    })
  },
})
