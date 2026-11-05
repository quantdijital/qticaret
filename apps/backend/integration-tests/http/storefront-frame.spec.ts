import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Frame {
  features?: { gift_cards: boolean; product_addons: boolean }
  marks?: { payments: string[]; carriers: string[] }
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
        // The payment page by the shop's own address, no shipping page (adr/0046 Ek 2026-11-05)
        payment_info_path: "/Taksit-Secenekleri",
        shipping_info_path: null,
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
        payment_info_path: "/odeme-secenekleri",
        shipping_info_path: "/kargo-ve-teslimat",
        color_swatches: [],
      })
      expect(before.data.free_shipping_threshold).toBeNull()
      // Gift cards and add-ons are off until the shop turns them on (F4.8, adr/0052)
      expect(before.data.features).toEqual({ gift_cards: false, product_addons: false })
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
        payment_info_path: "/taksit-secenekleri",
        shipping_info_path: null,
        color_swatches: [],
      })
      expect(after.data.free_shipping_threshold).toBe(1500)
      expect(withQuery.status).toBe(400)
    })

    it("names the ways to pay and the ETBİS QR code only as the shop set them up (adr/0046 Ek 2026-11-04)", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const frame = () => settle(http.get<Frame>("/store/storefront", { headers: store.headers }))
      const identity = () =>
        settle(
          http.get<{ identity: { etbis_qr: { url: string; width: number | null } | null } }>(
            "/store/legal-identity",
            { headers: store.headers }
          )
        )
      const save = (section: string, body: unknown) =>
        settle(http.post(`/admin/platform-settings/${section}`, body, { headers: owner.headers }))

      const before = await frame()
      const noQr = await identity()
      await save("bank_transfer", {
        enabled: true,
        account_holder: "Örnek Ticaret Ltd. Şti.",
        bank_name: "Ziraat Bankası",
        iban: "TR33 0006 1005 1978 6457 8413 26",
      })
      const script = await save("store", { etbis_qr_url: "javascript:alert(1)" })
      await save("store", { etbis_qr_url: "https://cdn.example.com/etbis-karekod.png" })
      const after = await frame()
      const withQr = await identity()
      // Settings outlive the database reset between tests (their cache)
      await save("bank_transfer", { enabled: false })
      await save("store", { etbis_qr_url: null })

      expect(before.data.marks).toEqual({ payments: [], carriers: [] })
      expect(noQr.data.identity.etbis_qr).toBeNull()
      expect(script.status).toBe(400)
      expect(after.data.marks).toEqual({ payments: ["bank_transfer"], carriers: [] })
      expect(withQr.data.identity.etbis_qr).toEqual({
        url: "https://cdn.example.com/etbis-karekod.png",
        alt: null,
        width: null,
        height: null,
        derivatives: null,
      })
      // The low-stock threshold stays inside: the card facts apply it
      expect(after.data.storefront).not.toHaveProperty("low_stock_threshold")
    })

    it("says whether the shop sells product add-ons, so the storefront skips their calls when off", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const frame = () => settle(http.get<Frame>("/store/storefront", { headers: store.headers }))
      const flag = (enabled: boolean) =>
        settle(http.post("/admin/features/catalog.addons", { enabled }, { headers: owner.headers }))

      const off = await frame()
      await flag(true)
      const on = await frame()
      // Flags live in settings, whose cache outlives the database reset between tests
      await flag(false)

      expect(off.data.features?.product_addons).toBe(false)
      expect(on.data.features).toEqual({ gift_cards: false, product_addons: true })
    })
  },
})
