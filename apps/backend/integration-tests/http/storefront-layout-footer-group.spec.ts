import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface StoreLayout {
  layout: { home: Section[]; footer: Section[] }
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})
const richText = (id: string, text: string): Section => ({
  id,
  type: "rich_text",
  ...ALWAYS,
  title: "Neden biz",
  body: doc(text),
})
const badges: Section = { id: "altguvence1", type: "trust_badges", ...ALWAYS, variant: "lined" }
const strip = (id: string, more: Record<string, unknown> = {}): Section => ({
  id,
  type: "marquee",
  ...ALWAYS,
  items: [{ text: "Aynı gün kargo" }],
  ...more,
})
const box: Section = {
  id: "altbulten01",
  type: "newsletter",
  ...ALWAYS,
  title: "Haberdar olun",
  text: "Onay metni.",
}

/**
 * The footer group (adr/0070 §4): a rich text, trust badges and a
 * scrolling strip beside the newsletter box, held to the page sections'
 * checks (the shop's `{belirteç}`s, records that exist) and printed as a
 * page's sections, in the group's order; a hidden one is not printed.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    describe("the footer group's sections", () => {
      it("checks them as a page's and prints them in the group's order", async () => {
        const container = getContainer()
        const owner = await createAdminUser(http, container)
        const store = await createStorefront(container)
        const asOwner = { headers: owner.headers }
        const save = (footer: Section[]) =>
          settle(
            http.post<{ message?: string }>(
              "/admin/storefront-layout",
              { document: { header: [], home: [], footer, product: [], category: [] } },
              asOwner
            )
          )
        const answer = async (footer: Section[]) => {
          const saved = await save(footer)
          return [saved.status, saved.data.message]
        }

        // A detail the shop has no such name for, and a strip linking a product that is not
        expect(await answer([richText("altmetin001", "Bize {yok_boyle} yazın")])).toEqual([
          400,
          "storefront_layout.token_unknown",
        ])
        const gone = { kind: "category", target: "pcat_yok", label: null }
        expect(
          await answer([strip("altkayan001", { items: [{ text: "Yeni", link: gone }] })])
        ).toEqual([400, "storefront_layout.target_unknown"])
        // A picture section is not the footer's (every page's load)
        expect(
          await answer([{ id: "altbanner01", type: "banner", ...ALWAYS, slides: [] }])
        ).toEqual([400, "storefront_layout.section_invalid"])

        const saved = await save([
          strip("altkayan001"),
          richText("altmetin001", "Ustalıkla seçilmiş ürünler"),
          { ...badges, visible: false },
          box,
        ])
        expect(saved.status).toBe(200)
        expect(
          (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
        ).toBe(200)
        const live = await settle(
          http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
        )
        expect(live.status).toBe(200)
        expect(live.data.layout.footer.map((section) => section.id)).toEqual([
          "altkayan001",
          "altmetin001",
          "altbulten01",
        ])
        expect(live.data.layout.footer).toMatchObject([
          { type: "marquee", items: [{ text: "Aynı gün kargo", link: null }] },
          {
            type: "rich_text",
            title: "Neden biz",
            html: expect.stringContaining("Ustalıkla seçilmiş ürünler") as unknown,
          },
          { type: "newsletter", title: "Haberdar olun" },
        ])
      })
    })
  },
})
