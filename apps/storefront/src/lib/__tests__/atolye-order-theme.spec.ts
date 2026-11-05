import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { OrderActions, OrderPageView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The theme's order page, the thank-you page fresh from checkout
 * (design.md § Satın alma sayfaları): the order's graphite opening, its
 * steps and what happens next, the transfer's account, the parcels'
 * tracking, the totals, the way back to the order and an account offered
 * to a guest.
 */

const actions: OrderActions = {
  cancelOrder: () => Promise.resolve(),
  requestReturn: () => Promise.resolve({ ok: true, error: null }),
}

const view = (over: Partial<OrderPageView> = {}): OrderPageView => ({
  displayId: "697",
  placedAt: "5 Kasım 2026 14:06",
  fresh: true,
  email: "ayse@quantdijital.com",
  status: "Hazırlanıyor",
  paymentStatus: "Ödendi",
  bankTransfer: null,
  cashOnDelivery: false,
  lines: [
    {
      title: "Kalem Ucu Çakı",
      detail: "Kiremit",
      quantity: 1,
      total: "314,30 TL",
      image: null,
      addons: [],
      nonWithdrawable: false,
    },
  ],
  items: "449,00 TL",
  discount: "134,70 TL",
  shipping: "95,00 TL",
  total: "409,30 TL",
  address: {
    email: "ayse@quantdijital.com",
    name: "Ayşe Yılmaz",
    lines: ["Cumhuriyet Cad. No: 12", "Merkezefendi, Denizli 20010"],
    phone: "0532 123 45 67",
  },
  documents: [{ label: "Ön bilgilendirme formu", path: "/siparis/order_1/belge/on-bilgilendirme" }],
  breadcrumbs: [],
  token: "abc",
  orderId: "order_1",
  cancellable: true,
  returnable: null,
  returnReasons: [],
  returns: [],
  shipments: [],
  notice: null,
  progress: [
    { key: "placed", label: "Sipariş alındı", state: "done", at: "5 Kasım 2026 14:06" },
    { key: "paid", label: "Ödeme onaylandı", state: "done", at: null },
    { key: "packed", label: "Hazırlanıyor", state: "current", at: null },
    { key: "shipped", label: "Kargoya verildi", state: "ahead", at: null },
    { key: "delivered", label: "Teslim edildi", state: "ahead", at: null },
  ],
  payment: "Kredi / banka kartı",
  guest: true,
  ...over,
})

describe("the theme's order page", () => {
  it("thanks the shopper in its one heading, with the order's number and how it is paid", () => {
    const html = renderPage(atolyeTheme, "OrderPage", { view: view(), actions })
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>Teşekkürler, siparişiniz alındı<\/h1>/)
    expect(html).toContain("#697")
    expect(html).toContain("Kredi / banka kartı")
    expect(html).toContain("ayse@quantdijital.com adresine gönderildi")
  })

  it("draws the steps, the current one marked, and says what happens next", () => {
    const html = renderPage(atolyeTheme, "OrderPage", { view: view(), actions })
    expect(html).toMatch(/<li aria-current="step"[^>]*>[\s\S]*?Hazırlanıyor/)
    expect(html).toContain("Kargoya verildiğinde takip numarası e-postanıza gelir.")
  })

  it("offers a guest the lookup and an account, a customer their orders", () => {
    const guest = renderPage(atolyeTheme, "OrderPage", { view: view(), actions })
    expect(guest).toContain('href="/siparis"')
    expect(guest).toContain('href="/hesap/kayit"')
    const customer = renderPage(atolyeTheme, "OrderPage", { view: view({ guest: false }), actions })
    expect(customer).toContain('href="/hesap/siparisler"')
    expect(customer).not.toContain('href="/hesap/kayit"')
  })

  it("gives a transfer's account with its IBAN once", () => {
    const html = renderPage(atolyeTheme, "OrderPage", {
      view: view({
        bankTransfer: {
          accountHolder: "My L'arte",
          bankName: "Banka",
          iban: "TR33 0006 1005 1978 6457 8413 26",
          amount: "409,30 TL",
          deadlineHours: 48,
        },
      }),
      actions,
    })
    expect(html.match(/IBAN/g)).toHaveLength(1)
    expect(html).toContain("TR33 0006 1005 1978 6457 8413 26")
    // The opening's one button leads down to the account to pay to, shopping on beside it
    expect(html).toMatch(/<a href="#havale" class="gf-btn">[\s\S]*?Havale bilgilerine geçin<\/a>/)
    expect(html).toContain('id="havale"')
    expect(html).toMatch(/<a href="\/" class="gf-link">Alışverişe devam et<\/a>/)
  })

  it("keeps a line's total under its name on a phone, beside it from 640 px", () => {
    const html = renderPage(atolyeTheme, "OrderPage", { view: view(), actions })
    expect(html).toMatch(/class="[^"]*sm:hidden[^"]*">314,30 TL</)
    expect(html).toMatch(/class="[^"]*max-sm:hidden[^"]*">314,30 TL</)
    // No transfer waits: the opening's button is the way back to the shop
    expect(html).not.toContain('href="#havale"')
  })

  it("links each parcel to its carrier's own tracking page", () => {
    const html = renderPage(atolyeTheme, "OrderPage", {
      view: view({
        shipments: [
          {
            carrier: "Aras Kargo",
            trackingNumber: "1234567890",
            trackingUrl: "https://kargotakip.araskargo.com.tr/mainpage.aspx?code=1234567890",
            status: "Yolda",
            items: "Kalem Ucu Çakı × 1",
          },
        ],
      }),
      actions,
    })
    expect(html).toContain("Takip no: 1234567890")
    expect(html).toContain(
      'href="https://kargotakip.araskargo.com.tr/mainpage.aspx?code=1234567890"'
    )
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it("names the order without thanks when opened later, and draws no steps for a cancelled one", () => {
    const html = renderPage(atolyeTheme, "OrderPage", {
      view: view({ fresh: false, progress: null, cancellable: false }),
      actions,
    })
    expect(html).toMatch(/<h1[^>]*>Sipariş #697<\/h1>/)
    expect(html).not.toContain("Sipariş durumu")
    expect(html).not.toContain("Siparişi iptal et")
  })
})
