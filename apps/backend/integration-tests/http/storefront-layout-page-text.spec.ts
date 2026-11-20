import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { CONTENT_SAVED } from "../../src/workflows/content/workflows"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { writePageText } from "../helpers/pages"
import { adminOrigin, sessionCookie } from "../helpers/staff-account"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface PageAnswer {
  page: { page_id: string; synthesized?: true; sections: Section[] } | null
}

const paragraph = (value: string) => ({
  type: "paragraph",
  content: [{ type: "text", text: value }],
})
const doc = (...values: string[]) => ({ type: "doc", content: values.map(paragraph) })
const article = (id: string, body: unknown, more: Record<string, unknown> = {}) => ({
  id,
  type: "rich_text",
  variant: "article",
  body,
  ...more,
})
const help = (id: string) => ({ id, type: "help", title: "Hangi bıçak size uygun?" })
const kindOf = (section: Section) =>
  section.type === "rich_text" ? `rich_text:${String(section["variant"])}` : section.type

/**
 * adr/0073 Ek 2026-11-19 (2) K1, K2, K5, K6: a content page's text is its
 * sections in the theme editor's design. A publication writes the page's
 * `body` mirror where its published text changed (news for the advisor),
 * and takes the pages in draft it names live with it; the store reads
 * answer a page without an entry with its text as sections, by its role.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("mirrors the published text into the page, takes the named draft pages live", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      const content = container.resolve<ContentModuleService>(CONTENT_MODULE)
      const page = async (title: string, status: "draft" | "published") =>
        (
          await settle(
            http.post<{ entry: { id: string } }>(
              "/admin/content",
              { kind: "page", title, status },
              asOwner
            )
          )
        ).data.entry.id
      const about = await page("Hakkımızda", "published")
      const fresh = await page("Yeni sayfa", "draft")
      const post = (
        await settle(
          http.post<{ entry: { id: string } }>(
            "/admin/content",
            { kind: "post", title: "Duyuru" },
            asOwner
          )
        )
      ).data.entry.id
      await writePageText(container, about, doc("Eski metin."))
      const entry = async (id: string) =>
        (
          await content.listContentEntries(
            { id },
            {
              select: [
                "body",
                "body_summary",
                "word_count",
                "status",
                "published_at",
                "revised_at",
                "updated_at",
              ],
            }
          )
        )[0]
      // What the advisor hears: the pages saved
      const saved: string[] = []
      container.resolve(Modules.EVENT_BUS).subscribe(
        CONTENT_SAVED,
        ({ data }: { data: unknown }) => {
          saved.push((data as { id: string }).id)
          return Promise.resolve()
        },
        { subscriberId: `page-text-${randomUUID()}` }
      )
      const save = (pages: unknown[]) =>
        settle(
          http.post(
            "/admin/storefront-layout",
            { document: { header: [], home: [], footer: [], pages } },
            asOwner
          )
        )
      const publish = (body: Record<string, unknown> = {}) =>
        settle(http.post<{ message?: string }>("/admin/storefront-layout/publish", body, asOwner))

      const titled = article("hikaye0001", doc("Atölye."), { title: "Hikâyemiz" })
      expect(
        (
          await save([
            {
              page_id: about,
              sections: [
                article("metin00001", doc("Yeni metin, iki satır.")),
                help("yardim001"),
                titled,
              ],
            },
            { page_id: fresh, sections: [article("metin00002", doc("Taslak metin."))] },
          ])
        ).status
      ).toBe(200)
      // Saved, not published: the page's text is as it was
      expect((await entry(about))?.body).toEqual(doc("Eski metin."))

      // A post is no page to take live: refused, and the publication with it
      const refused = await publish({ pages_live: [post] })
      expect([refused.status, refused.data.message]).toEqual([
        400,
        "storefront_layout.page_invalid",
      ])
      expect((await entry(about))?.body).toEqual(doc("Eski metin."))
      expect((await entry(fresh))?.status).toBe("draft")

      const published = await publish({ pages_live: [fresh] })
      expect(published.status).toBe(200)
      const mirrored = await entry(about)
      // The text sections in order, a titled one's title first as an h2
      expect(mirrored?.body).toEqual({
        type: "doc",
        content: [
          paragraph("Yeni metin, iki satır."),
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hikâyemiz" }] },
          paragraph("Atölye."),
        ],
      })
      expect(mirrored?.body_summary).toContain("Yeni metin, iki satır.")
      expect(mirrored?.word_count).toBe(6)
      // A live page's text changed: its revision date moves (sitemap `lastmod`, JSON-LD)
      expect(mirrored?.revised_at).not.toBeNull()
      const went = await entry(fresh)
      expect(went?.status).toBe("published")
      expect(went?.published_at).not.toBeNull()
      expect(went?.body).toEqual(doc("Taslak metin."))
      // Each page once for the advisor
      const heard = await eventually(
        () => Promise.resolve([...saved]),
        (ids) => ids.includes(about) && ids.includes(fresh)
      )
      expect(heard.filter((id) => id === about)).toHaveLength(1)
      expect(heard.filter((id) => id === fresh)).toHaveLength(1)

      // Published again unchanged: no page written, no news
      const before = await entry(about)
      expect((await publish()).status).toBe(200)
      await new Promise((resolve) => setTimeout(resolve, 500))
      expect((await entry(about))?.updated_at).toEqual(before?.updated_at)
      expect(saved).toHaveLength(heard.length)

      // The text taken off the page: its mirror is empty
      expect((await save([{ page_id: about, sections: [help("yardim001")] }])).status).toBe(200)
      expect((await publish()).status).toBe(200)
      expect((await entry(about))?.body).toEqual({ type: "doc", content: [] })
    })

    it("answers a page with no entry with its text as sections, by its role, and shows a draft only in a session", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const page = async (title: string, status: "draft" | "published") => {
        const id = (
          await settle(
            http.post<{ entry: { id: string } }>(
              "/admin/content",
              { kind: "page", title, status },
              asOwner
            )
          )
        ).data.entry.id
        await writePageText(container, id, doc(`${title} metni.`))
        return id
      }
      const contact = await page("İletişim", "published")
      const payment = await page("Ödeme", "published")
      const draft = await page("Taslak", "draft")
      await settle(
        http.post(
          "/admin/platform-settings/storefront",
          { contact_page_id: contact, payment_page_id: payment },
          asOwner
        )
      )
      const read = (path: string) => settle(http.get<PageAnswer>(path, { headers: store.headers }))

      const asContact = await read(`/store/storefront-layout/pages/${contact}`)
      expect(asContact.data.page).toMatchObject({ page_id: contact, synthesized: true })
      expect(asContact.data.page?.sections.map(kindOf)).toEqual(["contact"])
      expect(asContact.data.page?.sections[0]).toMatchObject({ form: "on", imprint: "on" })
      expect(asContact.data.page?.sections[0]?.["html"]).toContain("İletişim metni.")
      const asPayment = await read(`/store/storefront-layout/pages/${payment}`)
      expect(asPayment.data.page?.sections.map(kindOf)).toEqual([
        "rich_text:article",
        "payment_facts",
      ])
      // A draft page leaves through no public read, nor a design link (K10)
      expect((await read(`/store/storefront-layout/pages/${draft}`)).data).toEqual({ page: null })
      await settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [], pages: [] } },
          asOwner
        )
      )
      const link = await settle(
        http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
      )
      const linkToken = link.data.path.split("/").pop() ?? ""
      expect(
        (await read(`/store/storefront-layout/preview/${linkToken}/pages/${draft}`)).data
      ).toEqual({ page: null })
      expect(
        (await read(`/store/storefront-layout/preview/${linkToken}/pages/${contact}`)).data.page
      ).toMatchObject({ synthesized: true })

      // The editor's live session: the draft page's text as sections too
      const cookie = sessionCookie(await http.post("/auth/session", {}, { headers: owner.plain }))
      const opened = await settle(
        http.post<{ path: string }>(
          "/admin/storefront-layout/editor-session",
          {},
          { headers: { cookie, origin: adminOrigin() } }
        )
      )
      const token = opened.data.path.split("/").pop() ?? ""
      const inSession = await read(`/store/storefront-layout/session/${token}/pages/${draft}`)
      expect(inSession.data.page).toMatchObject({ page_id: draft, synthesized: true })
      expect(inSession.data.page?.sections[0]?.["html"]).toContain("Taslak metni.")
    })
  },
})
