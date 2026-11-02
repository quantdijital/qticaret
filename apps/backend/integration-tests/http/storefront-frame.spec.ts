import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Frame {
  features?: { gift_cards: boolean }
  storefront: {
    announcements: string[]
    trust_badges: { icon: string; title: string; text: string | null }[]
    primary_color: string | null
    hero: unknown
  }
  free_shipping_threshold: number | null
}

/** F18 D3 (docs/19 §4): the shop writes the storefront's frame; the storefront reads it. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("serves the frame the shop saved with its details filled, and refuses a script link", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const frame = () => settle(http.get<Frame>("/store/storefront", { headers: store.headers }))
      const save = (body: unknown) =>
        settle(http.post("/admin/platform-settings/storefront", body, { headers: owner.headers }))

      const before = await frame()
      const script = await save({
        hero: {
          eyebrow: null,
          heading: "Giriş",
          text: null,
          links: [{ label: "Tıkla", href: "javascript:alert(document.cookie)" }],
        },
      })
      const misspelt = await save({ announcements: ["{ucretsiz_kargo} ve üzeri kargo bedava"] })
      const saved = await save({
        announcements: ["{ücretsiz_kargo_eşiği} ve üzeri kargo bedava"],
        trust_badges: [{ icon: "clock", title: "Aynı gün kargo", text: "16:00'ya kadar" }],
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
        trust_badges: [],
        primary_color: null,
        hero: null,
        contact_form_path: "/iletisim",
        color_swatches: [],
      })
      expect(before.data.free_shipping_threshold).toBeNull()
      // Gift cards are off until the shop turns them on (F4.8)
      expect(before.data.features).toEqual({ gift_cards: false })
      expect(before.headers["cache-control"]).toContain("max-age=300")
      expect(script.status).toBe(400)
      // A misspelt detail would show as typed: refused, naming the ones there are (adr/0048)
      expect(misspelt.status).toBe(400)
      expect(JSON.stringify(misspelt.data)).toContain("platform_settings.token_unknown")
      expect(saved.status).toBe(200)
      expect(after.data.storefront).toEqual({
        // The threshold as the promotions section says it now
        announcements: ["₺1.500 ve üzeri kargo bedava"],
        trust_badges: [{ icon: "clock", title: "Aynı gün kargo", text: "16:00'ya kadar" }],
        primary_color: null,
        hero: null,
        contact_form_path: "/iletisim",
        color_swatches: [],
      })
      expect(after.data.free_shipping_threshold).toBe(1500)
      expect(withQuery.status).toBe(400)
    })
  },
})
