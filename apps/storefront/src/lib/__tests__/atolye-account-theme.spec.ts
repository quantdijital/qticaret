import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { AccountActions, AccountOrderView, AccountPageView, OrderStepView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"

/**
 * The theme's account pages (design.md § Hesap) with the storefront's
 * field names and handlers kept: the hub, the latest order on a graphite
 * stage, the orders with their steps, favourites as the shop's cards,
 * the address book with the TR selects, the details and consents.
 */

const done = () => Promise.resolve()
const saved = () => Promise.resolve({ ok: true, error: null })
const actions: AccountActions = {
  removeAddress: done,
  addAddress: saved,
  districts: () => Promise.resolve([]),
  neighborhoods: () => Promise.resolve([]),
  requestPrivacy: done,
  saveBilling: saved,
  removeFavorite: done,
  saveProfile: saved,
  saveConsents: saved,
  logout: done,
}

const steps = (current: number): OrderStepView[] =>
  (["placed", "paid", "packed", "shipped", "delivered"] as const).map((key, index) => ({
    key,
    label: t(key === "paid" && index === current ? "order.step_paid_waiting" : `order.step_${key}`),
    state: index < current ? "done" : index === current ? "current" : "ahead",
    at: index < current ? "5 Kasım 2026" : null,
  }))

const order = (id: string, over: Partial<AccountOrderView> = {}): AccountOrderView => ({
  displayId: id,
  placedAt: "5 Kasım 2026",
  status: "Hazırlanıyor",
  paymentStatus: "Ödeme bekleniyor",
  total: "1.179,30 TL",
  itemCount: 1,
  path: `/siparis/order_${id}`,
  images: [],
  progress: steps(1),
  ...over,
})

const SECTIONS = [
  ["overview", "/hesap", "account.overview"],
  ["orders", "/hesap/siparisler", "account.orders"],
  ["favorites", "/hesap/favoriler", "account.favorites"],
  ["addresses", "/hesap/adresler", "account.addresses"],
  ["profile", "/hesap/bilgiler", "account.details"],
] as const

const account = (over: Partial<AccountPageView> = {}): AccountPageView => {
  const section = over.section ?? "overview"
  return {
    section,
    name: "Elif",
    email: "elif@example.com",
    nav: SECTIONS.map(([each, path, key]) => ({
      label: t(key),
      path,
      current: each === section,
      section: each,
    })),
    notice: null,
    orders: [],
    pagination: null,
    addresses: [],
    newAddress: null,
    favorites: [],
    privacyRequests: [],
    billing: null,
    profile: {
      first_name: "Elif",
      last_name: "Yıldız",
      phone: "0532 123 45 67",
      marketingEmail: true,
      marketingSms: false,
      marketingVersion: "v1",
    },
    ...over,
  }
}

const tile = { label: "Çakılar", path: "/kategori/cakilar", image: null }

describe("the theme's account pages", () => {
  it("opens on the latest order's stage with its steps, the hub and the earlier orders", () => {
    const html = renderPage(atolyeTheme, "AccountPage", {
      view: account({ orders: [order("713"), order("712")] }),
      actions,
    })
    expect(html).toMatch(/<h1[^>]*>Merhaba Elif<\/h1>/)
    expect(html).toContain(t("account.latest_order"))
    expect(html).toContain('aria-current="step"')
    expect(html).toContain(t("order.next_paid"))
    expect(html).toContain('href="/siparis/order_713"')
    expect(html).toContain('href="/siparis/order_712"')
    expect(html).toContain(t("account.hub_addresses"))
    expect(html).toContain(t("account.earlier_orders"))
    // The hub leads to the sections, never to the overview itself
    expect(html).not.toMatch(/<a href="\/hesap"/)
    // On a phone the hub is the account's menu: it leads, over the latest order
    expect(html).toMatch(/<nav aria-label="[^"]*" class="[^"]*max-lg:order-first/)
  })

  it("offers the shop's categories as picture tiles when there is no order yet", () => {
    const html = renderPage(atolyeTheme, "AccountPage", {
      view: account({ categories: [tile] }),
      actions,
    })
    expect(html).toContain(t("account.no_orders"))
    expect(html).toContain('href="/kategori/cakilar"')
  })

  it("lists every order with its status in words beside its step bar, and the pages", () => {
    const html = renderPage(atolyeTheme, "AccountPage", {
      view: account({
        section: "orders",
        orders: [
          order("713", { progress: steps(3) }),
          order("700", { progress: null, status: "İptal edildi" }),
        ],
        pagination: {
          page: 1,
          pages: 2,
          previous: null,
          next: "/hesap/siparisler?sayfa=2",
          pagePath: { 1: "/hesap/siparisler", 2: "/hesap/siparisler?sayfa=2" },
        },
      }),
      actions,
    })
    expect(html).toMatch(/<h1[^>]*>Siparişlerim<\/h1>/)
    expect(html).toContain(t("order.step_packed"))
    expect(html).toContain("İptal edildi")
    expect(html).toContain('href="/hesap/siparisler?sayfa=2"')
    expect(html).toContain('aria-current="page"')
  })

  it("draws favourites as the shop's cards, each with a heart that takes it off", () => {
    const html = renderPage(atolyeTheme, "AccountPage", {
      view: account({
        section: "favorites",
        favorites: [
          {
            id: "wish_1",
            title: "Kalem Ucu Çakı",
            path: "/urun/kalem-ucu-caki",
            image: null,
            card: {
              id: "prod_1",
              title: "Kalem Ucu Çakı",
              path: "/urun/kalem-ucu-caki",
              image: null,
              brand: "My L'arte",
              price: { current: "279,30 TL", before: "399,00 TL", from: false, discount: 30 },
              available: true,
            },
          },
          { id: "wish_2", title: "Gama Balta", path: "/urun/gama-balta", image: null, card: null },
        ],
      }),
      actions,
    })
    expect(html).toContain("279,30 TL")
    expect(html).toContain('name="id" value="wish_1"')
    expect(html).toContain('href="/urun/gama-balta"')
    expect(html).toContain('aria-label="Favorilerden çıkar: Kalem Ucu Çakı"')
  })

  it("keeps the address book's fields: the cards to remove and the TR selects without the e-mail", () => {
    const html = renderPage(atolyeTheme, "AccountPage", {
      view: account({
        section: "addresses",
        addresses: [
          {
            id: "cuaddr_1",
            name: "Elif Yıldız",
            lines: ["Kınıklı Cad. No: 12", "Pamukkale, Denizli"],
          },
        ],
        newAddress: {
          values: {
            email: "elif@example.com",
            phone: "",
            first_name: "Elif",
            last_name: "Yıldız",
            province: "",
            district: "",
            neighborhood: "",
            address_1: "",
          },
          provinces: [{ value: "20", label: "Denizli" }],
          districts: [],
          neighborhoods: [],
        },
      }),
      actions,
    })
    expect(html).toContain('name="id" value="cuaddr_1"')
    expect(html).toContain(t("account.address_remove_confirm"))
    for (const name of [
      "phone",
      "first_name",
      "last_name",
      "province",
      "district",
      "neighborhood",
      "address_1",
    ]) {
      expect(html).toContain(`name="${name}"`)
    }
    expect(html).not.toContain('name="email"')
    expect(html).toContain('id="yeni-adres"')
  })

  it("keeps the details page's forms and the KVKK requests", () => {
    const html = renderPage(atolyeTheme, "AccountPage", {
      view: account({
        section: "profile",
        privacyRequests: [
          {
            kind: "Veri kopyası",
            status: "İnceleniyor",
            received: "5 Kasım 2026",
            due: "5 Aralık 2026",
          },
        ],
      }),
      actions,
    })
    for (const name of [
      "first_name",
      "last_name",
      "phone",
      "type",
      "legal_name",
      "tax_id",
      "marketing_email",
      "marketing_sms",
      "marketing_version",
    ]) {
      expect(html).toContain(`name="${name}"`)
    }
    expect(html).toContain('name="kind" value="export"')
    expect(html).toContain('name="kind" value="erasure"')
    expect(html).toContain("Yanıt en geç: 5 Aralık 2026")
    expect(html).toContain('href="/hesap/sifre-sifirla"')
  })
})
