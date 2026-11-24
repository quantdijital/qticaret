import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import faqPagesIntoSections from "../../src/migration-scripts/faq-pages-into-sections"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { convertFaqTexts } from "../../src/workflows/storefront/faq-convert"
import { layoutRow } from "../../src/workflows/storefront/layout-row"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }
interface Entry {
  page_id: string
  sections: Section[]
}
type Stored = Record<string, unknown> & { pages?: Entry[] }

const BOLD = [{ type: "bold" }]
const para = (text: string, marks?: unknown[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
})
const heading = (text: string) => ({
  type: "heading",
  attrs: { level: 3 },
  content: [{ type: "text", text }],
})
// A questions page as the shop wrote it before: groups, bold questions, their answers
const QUESTIONS = {
  type: "doc",
  content: [
    heading("Kargo"),
    para("Ne zaman kargoya verilir?", BOLD),
    para("Hafta içi 16:00'a kadar verilen siparişler aynı gün."),
    para("Kargo ücreti ne kadar?", BOLD),
    para("500 TL üzeri ücretsiz."),
    heading("İade"),
    para("İade süresi ne kadar?", BOLD),
    para("14 gün."),
  ],
}
const kindOf = (section: Section) =>
  section.type === "rich_text" || section.type === "faq"
    ? `${section.type}:${typeof section["variant"] === "string" ? section["variant"] : ""}`
    : section.type
const entryOf = (doc: unknown, pageId: string) =>
  (doc as Stored).pages?.find((page) => page.page_id === pageId) ?? null

/**
 * adr/0073 Ek 2026-11-24 (2): a page drawn as questions out of its text
 * (`questions: auto`) becomes an FAQ section the shop edits question by
 * question, once, on `db:migrate`: drawn as before, the text kept hidden
 * after it, the draft and the live design alike (the live one as a system
 * revision, recorded); a second run writes nothing.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("turns a questions text into an FAQ in the draft and live, once, drawn as before", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const page = (
        await settle(
          http.post<{ entry: { id: string } }>(
            "/admin/content",
            { kind: "page", title: "Sık sorulan sorular", status: "published" },
            asOwner
          )
        )
      ).data.entry.id
      const text = { id: "sssmetni01", type: "rich_text", variant: "article", body: QUESTIONS }
      const design = {
        header: [],
        home: [],
        footer: [],
        pages: [{ page_id: page, sections: [text] }],
      }
      expect(
        (await settle(http.post("/admin/storefront-layout", { document: design }, asOwner))).status
      ).toBe(200)
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const before = await layoutRow(container)
      if (!before) {
        throw new Error("no design")
      }
      const read = async () =>
        (
          await settle(
            http.get<{ page: { sections: Section[] } | null }>(
              `/store/storefront-layout/pages/${page}`,
              { headers: store.headers }
            )
          )
        ).data.page
      expect((await read())?.sections.map(kindOf)).toEqual(["rich_text:article"])

      await faqPagesIntoSections({ container } as never)

      const after = await layoutRow(container)
      expect(after?.revision).toBe(before.revision + 1)
      for (const doc of [after?.draft, after?.published]) {
        const sections = entryOf(doc, page)?.sections ?? []
        expect(sections.map(kindOf)).toEqual(["faq:page", "rich_text:article"])
        // The text stays, hidden, as it was
        expect(sections[1]).toMatchObject({ id: "sssmetni01", visible: false, body: QUESTIONS })
      }
      // The live page: the FAQ's rows, every answer as the backend's HTML
      const live = await read()
      expect(live?.sections.map(kindOf)).toEqual(["faq:page"])
      expect(live?.sections[0]).toMatchObject({
        type: "faq",
        variant: "page",
        items: [
          { heading: "Kargo" },
          {
            question: "Ne zaman kargoya verilir?",
            html: "<p>Hafta içi 16:00&#39;a kadar verilen siparişler aynı gün.</p>",
          },
          { question: "Kargo ücreti ne kadar?", html: "<p>500 TL üzeri ücretsiz.</p>" },
          { heading: "İade" },
          { question: "İade süresi ne kadar?", html: "<p>14 gün.</p>" },
        ],
      })
      // The editor reads the draft as it saves it: one more save goes through
      const draft = await settle(
        http.get<{ layout: { draft: Stored } }>("/admin/storefront-layout", asOwner)
      )
      expect(entryOf(draft.data.layout.draft, page)?.sections.map(kindOf)).toEqual([
        "faq:page",
        "rich_text:article",
      ])
      const audit = await container
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ action: "storefront.faq_pages_converted" })
      expect(audit).toHaveLength(1)
      expect(audit[0]?.changes).toEqual({ converted: 1, left: 0, live: true })

      // A second run writes nothing
      const again = await convertFaqTexts(container)
      expect(again).toEqual({ converted: 0, left: 0, live: false })
      expect((await layoutRow(container))?.revision).toBe(after?.revision)
    })
  },
})
