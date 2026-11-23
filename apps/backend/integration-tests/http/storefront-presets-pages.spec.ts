import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { storefrontPreset } from "@qticaret/sector-packs"
import { createAdminUser } from "../helpers/admin"
import { LOOK, withCutlery } from "../helpers/designs"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { writePageText } from "../helpers/pages"
import { LAYOUT_LIMITS } from "../../src/lib/storefront/layout"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"

jest.setTimeout(240 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface PageLayout {
  page_id: string
  sections: Section[]
}

interface Draft extends Record<string, unknown> {
  pages: PageLayout[]
}

interface Applied {
  result: {
    skipped: { where: string; ref: string; name?: string }[]
    kept: string[]
    dropped_pages: number
    made_pages: { ref: string; page_id: string; name: string }[]
    texts_kept: { ref: string; name?: string }[]
  }
  layout: { draft: Draft }
}

const doc = (value: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
})

/**
 * adr/0073 §4, Ek 2026-11-19 (2) K6: a ready-made look lays out the shop's
 * own content pages by handle, a draft page too, keeping the shop's page
 * text; a page it does not lay out keeps the shop's layout. Opening a
 * missing page as a draft: `storefront-presets-pages-open.spec.ts`.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("lays out the shop's Hakkımızda page with its own text, keeps its İletişim layout", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      await withCutlery(container)
      const katalog = storefrontPreset(LOOK.pack, LOOK.code)
      const about = katalog?.layout.pages?.find(
        (page) => page.page_id.$handle === "page:hakkimizda"
      )
      if (!about) {
        throw new Error("katalog lays out no Hakkımızda page")
      }
      const content = async (body: Record<string, unknown>) =>
        (await settle(http.post<{ entry: { id: string } }>("/admin/content", body, asOwner))).data
          .entry.id
      const apply = () =>
        settle(
          http.post<Applied>(
            `/admin/storefront-presets/${LOOK.pack}/${LOOK.code}/apply`,
            {},
            asOwner
          )
        )

      // Hakkımızda still a draft; İletişim live, laid out by the shop
      const aboutId = await content({ kind: "page", title: "Hakkımızda", handle: "hakkimizda" })
      const contactId = await content({ kind: "page", title: "İletişim", handle: "iletisim" })
      // A page's text is the system's to write (adr/0073 Ek 2026-11-19 (2) K4)
      await writePageText(container, contactId, doc("Bize yazın."))
      expect(
        (await settle(http.post(`/admin/content/${contactId}`, { status: "published" }, asOwner)))
          .status
      ).toBe(200)
      const contactLayout = {
        page_id: contactId,
        sections: [{ id: "iletisimyardim", type: "help", title: "Bize yazın" }],
      }
      const saved = await settle(
        http.post<{ layout: { draft: Draft } }>(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [], pages: [contactLayout] } },
          asOwner
        )
      )
      expect(saved.status).toBe(200)
      const ownContact = saved.data.layout.draft.pages[0]

      // Written as the system writes a page's text: an article in the draft's entry for the page
      await writePageText(container, aboutId, doc("Atölyemiz Denizli'de."))
      const shopText = (
        await settle(http.get<{ layout: { draft: Draft } }>("/admin/storefront-layout", asOwner))
      ).data.layout.draft.pages.find((page) => page.page_id === aboutId)?.sections[0]
      expect(shopText).toMatchObject({ type: "rich_text", variant: "article" })

      const first = await apply()
      expect(first.status).toBe(200)
      // The page found though a draft: nothing skipped or opened for it; the shop's contact layout kept
      expect(first.data.result.skipped.filter((each) => each.where === "pages")).toEqual([])
      expect(first.data.result.made_pages).toEqual([])
      expect(first.data.result.kept).toContain(`pages.${contactId}`)
      expect(first.data.result.dropped_pages).toBe(0)
      const pages = first.data.layout.draft.pages
      expect(pages.map((page) => page.page_id)).toEqual([contactId, aboutId])
      expect(pages[0]).toEqual(ownContact)
      // The shop's text in the place of the look's own (K6, K9): never wiped, never overwritten
      const [look, ...design] = about.sections
      expect(look).toMatchObject({ type: "rich_text", variant: "article" })
      expect(pages[1]?.sections.map((section) => section.id)).toEqual([
        shopText?.id,
        ...design.map((section) => section.id),
      ])
      expect(pages[1]?.sections[0]).toEqual(shopText)
      expect(JSON.stringify(pages[1])).not.toContain("Köklerimizden geleceğe")
      expect(first.data.result.texts_kept).toEqual([{ ref: "page:hakkimizda", name: "Hakkımızda" }])
      // The bıçak pack's picture brought into the library beside the story
      expect(pages[1]?.sections[1]).toMatchObject({
        type: "rich_text",
        variant: "with_image",
        image_side: "end",
        image: { url: expect.any(String) as unknown },
      })

      // Applied again: the same draft
      const second = await apply()
      expect(second.status).toBe(200)
      expect(second.data.layout.draft.pages).toEqual(pages)

      // Published, the page's mirror opens with the shop's text, then the look's design texts (K2)
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const entry = await settle(
        http.get<{ entry: { body: unknown; status: string } }>(`/admin/content/${aboutId}`, asOwner)
      )
      const body = entry.data.entry.body as { content: unknown[] }
      expect(body.content[0]).toEqual(doc("Atölyemiz Denizli'de.").content[0])
      expect(JSON.stringify(body)).not.toContain("Köklerimizden")
    })

    it("keeps a page's text from its mirror when the draft lays it out without one", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      await withCutlery(container)
      const aboutId = (
        await settle(
          http.post<{ entry: { id: string } }>(
            "/admin/content",
            { kind: "page", title: "Hakkımızda", handle: "hakkimizda" },
            asOwner
          )
        )
      ).data.entry.id
      // Its text in the mirror alone: a page past the design's limit, or from before the
      // conversion (K1)
      await container
        .resolve<ContentModuleService>(CONTENT_MODULE)
        .updateContentEntries({ id: aboutId, body: doc("Bıçakçılık 1952'den beri.") })

      const applied = await settle(
        http.post<Applied>(`/admin/storefront-presets/${LOOK.pack}/${LOOK.code}/apply`, {}, asOwner)
      )

      expect(applied.status).toBe(200)
      const [page] = applied.data.layout.draft.pages
      expect(page?.page_id).toBe(aboutId)
      expect(page?.sections[0]).toMatchObject({
        type: "rich_text",
        variant: "article",
        body: doc("Bıçakçılık 1952'den beri."),
      })
      expect(page?.sections).toHaveLength(7)
      expect(applied.data.result.texts_kept).toEqual([
        { ref: "page:hakkimizda", name: "Hakkımızda" },
      ])
    })

    it("gives a page without text of the shop's the look's own text", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      await withCutlery(container)
      const katalog = storefrontPreset(LOOK.pack, LOOK.code)
      const aboutId = (
        await settle(
          http.post<{ entry: { id: string } }>(
            "/admin/content",
            { kind: "page", title: "Hakkımızda", handle: "hakkimizda" },
            asOwner
          )
        )
      ).data.entry.id

      const applied = await settle(
        http.post<Applied>(`/admin/storefront-presets/${LOOK.pack}/${LOOK.code}/apply`, {}, asOwner)
      )

      expect(applied.status).toBe(200)
      const [page] = applied.data.layout.draft.pages
      expect(page?.page_id).toBe(aboutId)
      expect(page?.sections.map((section) => section.id)).toEqual(
        katalog?.layout.pages?.[0]?.sections.map((section) => section.id)
      )
      expect(JSON.stringify(page?.sections[0])).toContain("Köklerimizden geleceğe.")
      expect(applied.data.result.texts_kept).toEqual([])
      expect(applied.data.result.made_pages).toEqual([])
    })

    it("applies the look without the Hakkımızda layout when fifty pages have their own", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      await withCutlery(container)
      const content = async (body: Record<string, unknown>) =>
        (await settle(http.post<{ entry: { id: string } }>("/admin/content", body, asOwner))).data
          .entry.id
      const aboutId = await content({ kind: "page", title: "Hakkımızda", handle: "hakkimizda" })
      await writePageText(container, aboutId, doc("Biz."))
      const own: PageLayout[] = []
      // The group's limit: fifty pages since every page with text has an entry (adr/0073 Ek
      // 2026-11-19 (2) K1)
      for (let index = 0; index < LAYOUT_LIMITS.pages; index++) {
        const id = await content({
          kind: "page",
          title: `Sayfa ${String(index + 1)}`,
          handle: `sayfa-${String(index + 1)}`,
        })
        own.push({
          page_id: id,
          sections: [{ id: `sayfayardim${String(index)}`, type: "help", title: "Bize yazın" }],
        })
      }
      const saved = await settle(
        http.post<{ layout: { draft: Draft } }>(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [], pages: own } },
          asOwner
        )
      )
      expect(saved.status).toBe(200)
      const before = saved.data.layout.draft.pages

      const applied = await settle(
        http.post<Applied>(`/admin/storefront-presets/${LOOK.pack}/${LOOK.code}/apply`, {}, asOwner)
      )
      // Warn, don't block: the look is applied, the page's layout left out and named
      expect(applied.status).toBe(200)
      expect(applied.data.result.skipped).toContainEqual({
        where: "pages",
        ref: "page:hakkimizda",
        name: "Hakkımızda",
        reason: "limit",
      })
      expect(applied.data.layout.draft.pages).toEqual(before)
      expect(applied.data.result.kept.filter((each) => each.startsWith("pages."))).toEqual(
        own.map((page) => `pages.${page.page_id}`)
      )
    })
  },
})
