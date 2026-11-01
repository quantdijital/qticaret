import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Frame {
  storefront: {
    announcements: string[]
    top_links: { label: string; href: string }[]
    footer_groups: { title: string; links: { label: string; href: string }[] }[]
    trust_badges: { icon: string; title: string; text: string | null }[]
    whatsapp_phone: string | null
  }
  free_shipping_threshold: number | null
}

/** F18 D3 (docs/19 §4): the shop writes the storefront's frame; the storefront reads it. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("serves the frame the shop saved, empty until then, and refuses a script link", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const frame = () => settle(http.get<Frame>("/store/storefront", { headers: store.headers }))
      const save = (body: unknown) =>
        settle(http.post("/admin/platform-settings/storefront", body, { headers: owner.headers }))

      const before = await frame()
      const script = await save({
        top_links: [{ label: "Tıkla", href: "javascript:alert(document.cookie)" }],
      })
      const saved = await save({
        announcements: ["1500 TL ve üzeri kargo bedava"],
        top_links: [{ label: "Hakkımızda", href: "/hakkimizda" }],
        footer_groups: [
          { title: "Müşteri Hizmetleri", links: [{ label: "İletişim", href: "/iletisim" }] },
        ],
        trust_badges: [{ icon: "clock", title: "Aynı gün kargo", text: "16:00'ya kadar" }],
        whatsapp_phone: "0532 123 45 67",
      })
      await settle(
        http.post(
          "/admin/platform-settings/promotions",
          { free_shipping_threshold: 1500 },
          { headers: owner.headers }
        )
      )
      const after = await frame()
      const withQuery = await settle(
        http.get("/store/storefront?fields=*", { headers: store.headers })
      )

      expect(before.status).toBe(200)
      expect(before.data.storefront).toEqual({
        announcements: [],
        top_links: [],
        footer_groups: [],
        trust_badges: [],
        whatsapp_phone: null,
      })
      expect(before.data.free_shipping_threshold).toBeNull()
      expect(before.headers["cache-control"]).toContain("max-age=300")
      expect(script.status).toBe(400)
      expect(saved.status).toBe(200)
      expect(after.data.storefront).toEqual({
        announcements: ["1500 TL ve üzeri kargo bedava"],
        top_links: [{ label: "Hakkımızda", href: "/hakkimizda" }],
        footer_groups: [
          { title: "Müşteri Hizmetleri", links: [{ label: "İletişim", href: "/iletisim" }] },
        ],
        trust_badges: [{ icon: "clock", title: "Aynı gün kargo", text: "16:00'ya kadar" }],
        whatsapp_phone: "+905321234567",
      })
      expect(after.data.free_shipping_threshold).toBe(1500)
      expect(withQuery.status).toBe(400)
    })
  },
})
