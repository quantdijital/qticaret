import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { storefrontPreset } from "@qticaret/sector-packs"
import { createAdminUser } from "../helpers/admin"
import { LOOK, withCutlery } from "../helpers/designs"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

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
  }
  layout: { draft: Draft }
}

const doc = (value: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
})

/**
 * adr/0073 §4: a ready-made look lays out the shop's own content pages
 * by handle, a draft page too; it never makes a page, and a page it does
 * not lay out keeps the shop's layout.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("lays out the shop's Hakkımızda page, keeps its İletişim layout, says when the page is missing", async () => {
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
      const aboutId = await content({
        kind: "page",
        title: "Hakkımızda",
        handle: "hakkimizda",
        body: doc("Atölyemiz Denizli'de."),
      })
      const contactId = await content({
        kind: "page",
        title: "İletişim",
        handle: "iletisim",
        body: doc("Bize yazın."),
      })
      expect(
        (await settle(http.post(`/admin/content/${contactId}`, { status: "published" }, asOwner)))
          .status
      ).toBe(200)
      const contactLayout = {
        page_id: contactId,
        sections: [{ id: "iletisimyardim", type: "help", title: "Bize yazın", placement: "top" }],
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

      const first = await apply()
      expect(first.status).toBe(200)
      // The page found though a draft: nothing skipped for it; the shop's contact layout kept, named
      expect(first.data.result.skipped.filter((each) => each.where === "pages")).toEqual([])
      expect(first.data.result.kept).toContain(`pages.${contactId}`)
      expect(first.data.result.dropped_pages).toBe(0)
      const pages = first.data.layout.draft.pages
      expect(pages.map((page) => page.page_id)).toEqual([contactId, aboutId])
      expect(pages[0]).toEqual(ownContact)
      expect(pages[1]?.sections.map((section) => section.id)).toEqual(
        about.sections.map((section) => section.id)
      )
      // The bıçak pack's picture brought into the library beside the story
      expect(pages[1]?.sections[0]).toMatchObject({
        type: "rich_text",
        variant: "with_image",
        image_side: "end",
        image: { url: expect.any(String) as unknown },
      })

      // Applied again: the same draft
      const second = await apply()
      expect(second.status).toBe(200)
      expect(second.data.layout.draft.pages).toEqual(pages)

      // The page deleted: its layout is not added, and the answer says why
      expect((await settle(http.delete(`/admin/content/${aboutId}`, asOwner))).status).toBe(200)
      const third = await apply()
      expect(third.status).toBe(200)
      expect(third.data.result.skipped).toContainEqual({
        where: "pages",
        ref: "page:hakkimizda",
        name: "Hakkımızda",
      })
      // The deleted page's old layout leaves with the save (adr/0073 §1)
      expect(third.data.result.dropped_pages).toBe(1)
      expect(third.data.layout.draft.pages).toEqual([ownContact])
    })
  },
})
