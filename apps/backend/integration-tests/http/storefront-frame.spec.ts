import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Frame {
  features?: {
    gift_cards: boolean
    product_addons: boolean
    booking: boolean
    collections: boolean
    natural_search: boolean
    popups: boolean
  }
  marks?: { payments: string[]; carriers: string[] }
  storefront: {
    announcements: string[]
    trust_badges: { icon: string; title: string; text: string | null }[]
    primary_color: string | null
    hero: unknown
  }
  free_shipping_threshold: number | null
  delivery?: {
    handling_days: { min: number; max: number }
    transit_days: { min: number; max: number }
    same_day_cutoff_hour: number | null
  }
}

const NO_ROLES = {
  contact_page_id: null,
  payment_page_id: null,
  shipping_page_id: null,
  contact_form_path: null,
  payment_info_path: null,
  shipping_info_path: null,
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
        // No content page yet at the addresses the roles start from (storefront-page-roles.spec.ts)
        ...NO_ROLES,
        color_swatches: [],
      })
      expect(before.data.free_shipping_threshold).toBeNull()
      // Gift cards and add-ons are off until the shop turns them on (F4.8, adr/0052)
      expect(before.data.features).toEqual({
        gift_cards: false,
        product_addons: false,
        booking: false,
        // Collections are on unless the shop turns them off
        collections: true,
        // Search in the shopper's own words is off until the shop turns it on (adr/0077 §7)
        natural_search: false,
        // Pop-ups are on (adr/0080): none shows until the shop makes one
        popups: true,
      })
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
        ...NO_ROLES,
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

    it("says when an order leaves and arrives and the same-day hour, as the shop set them under Kargo (adr/0046 Ek 2026-11-06)", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const frame = () => settle(http.get<Frame>("/store/storefront", { headers: store.headers }))
      const save = (section: string, body: unknown) =>
        settle(http.post(`/admin/platform-settings/${section}`, body, { headers: owner.headers }))

      const before = await frame()
      // A shop that set the hour under the feed rules before it moved under Kargo
      await save("marketing", { feed_same_day_cutoff_hour: 16 })
      const legacy = await frame()
      const days = await save("shipping", {
        handling_days_min: 0,
        handling_days_max: 1,
        transit_days_min: 2,
        transit_days_max: 4,
        same_day_cutoff_hour: 15,
      })
      const after = await frame()
      const late = await save("shipping", { same_day_cutoff_hour: 24 })
      // Settings outlive the database reset between tests (their cache)
      await save("shipping", {
        handling_days_min: 1,
        handling_days_max: 2,
        transit_days_min: 1,
        transit_days_max: 3,
        same_day_cutoff_hour: null,
      })
      await save("marketing", { feed_same_day_cutoff_hour: null })

      // A shop that set nothing: the platform's days, the products' shipping details say the same
      expect(before.data.delivery).toEqual({
        handling_days: { min: 1, max: 2 },
        transit_days: { min: 1, max: 3 },
        same_day_cutoff_hour: null,
      })
      expect(legacy.data.delivery?.same_day_cutoff_hour).toBe(16)
      expect(days.status).toBe(200)
      // Kargo's hour stands over the old one
      expect(after.data.delivery).toEqual({
        handling_days: { min: 0, max: 1 },
        transit_days: { min: 2, max: 4 },
        same_day_cutoff_hour: 15,
      })
      expect(late.status).toBe(400)
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
      expect(on.data.features).toEqual({
        gift_cards: false,
        product_addons: true,
        booking: false,
        collections: true,
        natural_search: false,
        popups: true,
      })
    })
  },
})
