import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface StoreLayout {
  layout: { header: Section[]; home: Section[]; category: Section[] }
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const document = (groups: { header?: Section[]; home?: Section[]; category?: Section[] }) => ({
  document: {
    header: groups.header ?? [],
    home: groups.home ?? [],
    footer: [],
    product: [],
    category: groups.category ?? [],
  },
})

/** adr/0049 Ek 2026-11-14 §4.1: the scrolling strip on a page and above the header. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves strips on a page and in the header, two a page at most, read with filled words and live links", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      await settle(
        http.post("/admin/platform-settings/store", { contact_phone: "0532 123 45 67" }, asOwner)
      )
      const category = (
        await settle(
          http.post<{ product_category: { id: string } }>(
            "/admin/product-categories",
            { name: "Çakılar", is_active: true },
            asOwner
          )
        )
      ).data.product_category.id
      const strip = (id: string, more: Record<string, unknown> = {}): Section => ({
        id,
        type: "marquee",
        ...ALWAYS,
        items: [
          {
            icon: "phone",
            text: "Sorularınız için {telefon}",
            subtext: "Hafta içi 09.00–18.00",
            link: { kind: "category", target: category, label: null },
          },
          { text: "Tüm ürünler", link: { kind: "system", target: "shop", label: "Mağaza" } },
        ],
        ...more,
      })
      const save = (body: ReturnType<typeof document>) =>
        settle(http.post<{ message?: string }>("/admin/storefront-layout", body, asOwner))

      const unknownTarget = await save(
        document({
          header: [
            strip("ustkayan01", {
              items: [{ text: "Yok", link: { kind: "category", target: "pcat_yok", label: null } }],
            }),
          ],
        })
      )
      const tooMany = await save(
        document({
          header: [strip("ustkayan01")],
          category: [strip("kategorikayan1"), strip("kategorikayan2", { visible: false })],
        })
      )
      const offList = await save(document({ home: [strip("anakayan01", { ground: "neon" })] }))
      const saved = await save(
        document({
          header: [
            { id: "duyuru0001", type: "announcement_bar", lines: ["Kargo bedava"] },
            strip("ustkayan01", { size: "small", separator: "none" }),
          ],
          home: [strip("anakayan01", { size: "large", direction: "right" })],
          category: [strip("kategorikayan1", { placement: "top" })],
        })
      )

      expect(unknownTarget.status).toBe(400)
      expect(unknownTarget.data.message).toBe("storefront_layout.target_unknown")
      expect(tooMany.status).toBe(400)
      expect(tooMany.data.message).toBe("storefront_layout.marquee_limit")
      expect(offList.status).toBe(400)
      expect(offList.data.message).toBe("storefront_layout.section_invalid")
      expect(saved.status).toBe(200)

      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const live = await settle(
        http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
      )
      const items = [
        {
          icon: "phone",
          text: "Sorularınız için 0532 123 45 67",
          subtext: "Hafta içi 09.00–18.00",
          link: { kind: "category", target: category, label: "Çakılar" },
        },
        {
          icon: null,
          text: "Tüm ürünler",
          subtext: null,
          link: { kind: "system", target: "shop", label: "Mağaza" },
        },
      ]
      expect(live.data.layout.header).toMatchObject([
        { id: "duyuru0001", type: "announcement_bar", lines: ["Kargo bedava"] },
        {
          id: "ustkayan01",
          type: "marquee",
          items,
          speed: "medium",
          direction: "left",
          ground: "stage",
          size: "small",
          separator: "none",
        },
      ])
      expect(live.data.layout.home[0]).toMatchObject({
        id: "anakayan01",
        type: "marquee",
        items,
        speed: "medium",
        direction: "right",
        ground: "stage",
        size: "large",
        separator: "dot",
      })
      expect(live.data.layout.category[0]).toMatchObject({ type: "marquee", placement: "top" })
    })
  },
})
