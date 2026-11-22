// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  ActionResult,
  BookingView,
  PlaceOrderResult,
  ProductPageView,
  ThemeActions,
} from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"
import { requestMonths } from "@/lib/views/booking"
// The theme's own parts: it exports pages, not these
import { BookingRequest } from "../../../../../packages/themes/atolye/src/product/BookingRequest"
import { requestWords } from "../../../../../packages/themes/atolye/src/product/request-words"

/**
 * A dated product's "call me" request in the Grafit theme (adr/0076 Ek
 * 2026-11-23): sold by request, the form stands in place of the cart; sold
 * both ways, a secondary button under the cart opens it; online, or
 * without the storefront's action, the page is drawn exactly as before.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const done = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })
const received = (): Promise<PlaceOrderResult> =>
  Promise.resolve({ ok: true, error: null, challenge: null })

const actions: ThemeActions = {
  addToCart: done,
  changeCartLine: () => Promise.resolve(),
  applyPromotion: done,
  removePromotion: () => Promise.resolve(),
  writeReview: done,
  askQuestion: done,
  stockAlert: received,
  addFavorite: done,
  installments: () => Promise.resolve(null),
  addBookingToCart: done,
  requestBooking: received,
}

const view = (over: Partial<BookingView> = {}): BookingView => ({
  categories: [{ variantId: "variant_yetiskin", title: "Yetişkin", pax: 1, ages: null }],
  departures: [
    {
      id: "bkslot_az",
      startsAt: "2026-12-12T06:00:00.000Z",
      label: "Cumartesi, 12 Aralık 2026 · 09:00",
      available: 3,
      status: "open",
      prices: [{ variantId: "variant_yetiskin", price: "1.750,50 TL", kurus: 175050 }],
    },
  ],
  fewLeft: 5,
  maxUnits: 8,
  privacyPath: "/yasal/kvkk-aydinlatma-metni",
  requestMonths: [
    { value: "2026-12", label: "Aralık 2026" },
    { value: "2027-01", label: "Ocak 2027" },
  ],
  ...over,
})

const product = (booking: BookingView): ProductPageView => ({
  id: "prod_01TUR",
  title: "Kapadokya Günübirlik Tur",
  subtitle: null,
  description: [],
  descriptionHtml: null,
  brand: null,
  breadcrumbs: [{ label: "Ana sayfa", path: "/" }],
  images: [],
  options: [],
  variants: [],
  selectedVariantId: null,
  specs: [],
  trustBadges: [],
  reviews: { average: null, count: 0, items: [] },
  questions: { count: 0, items: [] },
  related: [],
  whatsappHref: null,
  signedIn: false,
  loginPath: "/hesap/giris",
  shippingNote: null,
  booking,
})

const page = (booking: BookingView, with_: ThemeActions = actions) =>
  renderPage(atolyeTheme, "ProductPage", { view: product(booking), actions: with_ })

describe("a dated product's call-me request on its page", () => {
  it("changes nothing for a product sold online, or without the action", () => {
    const online = page(view())
    expect(page(view({ saleMode: "online" }))).toBe(online)
    const without: ThemeActions = { ...actions }
    delete without.requestBooking
    expect(page(view({ saleMode: "request" }), without)).toBe(online)
    expect(online).not.toContain("Sizi arayalım")
  })

  it("stands in place of the cart for a product sold by request only", () => {
    const html = page(view({ saleMode: "request" }))
    expect(html).not.toContain("Rezervasyon yap")
    expect(html).toContain("Sizi arayalım")
    expect(html).toContain("Talebimi gönder")
    expect(html).toMatch(/<label[^>]*for="sizi-arayalim-telefon"/)
    expect(html).toMatch(/id="sizi-arayalim-telefon"[^>]*required/)
    expect(html).toMatch(/name="consent"[^>]*required|required[^>]*name="consent"/)
    expect(html).toContain('href="/yasal/kvkk-aydinlatma-metni"')
    expect(html).toContain("Tarihim esnek")
    expect(html).toContain("Cumartesi, 12 Aralık 2026 · 09:00")
    // Never a price field in the form
    expect(html).not.toMatch(/name="(?:unit_)?price|name="amount"/)
  })

  it("keeps the cart and adds a secondary button when sold both ways", () => {
    const html = page(view({ saleMode: "both" }))
    expect(html).toContain("Rezervasyon yap")
    expect(html).toMatch(/aria-expanded="false"[^>]*>Sizi arayalım|aria-expanded="false"/)
    expect(html).not.toContain("Talebimi gönder")
  })

  it("offers open dates when there is no departure", () => {
    const html = page(view({ saleMode: "request", departures: [] }))
    expect(html).toContain("Talebimi gönder")
    expect(html).toMatch(/<option value="flexible"[^>]*selected|selected[^>]*value="flexible"/)
  })
})

describe("the request form in the browser", () => {
  let host: HTMLDivElement
  let root: Root
  let sent: FormData | null

  beforeEach(() => {
    sent = null
    host = document.createElement("div")
    document.body.append(host)
    root = createRoot(host)
    const action = (_state: PlaceOrderResult, form: FormData): Promise<PlaceOrderResult> => {
      sent = form
      return Promise.resolve({ ok: true, error: null, challenge: null })
    }
    act(() => {
      root.render(
        <BookingRequest
          productId="prod_01TUR"
          view={view({ saleMode: "request" })}
          action={action}
          words={requestWords(t)}
        />
      )
    })
  })
  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it("asks for a month when the shopper picks one, then says the request came", async () => {
    const when = host.querySelector<HTMLSelectElement>("#sizi-arayalim-tarih")
    expect(when?.value).toBe("bkslot_az")
    expect(host.querySelector("#sizi-arayalim-ay")).toBeNull()
    act(() => {
      if (when) {
        when.value = "month"
        when.dispatchEvent(new Event("change", { bubbles: true }))
      }
    })
    expect(host.querySelector<HTMLSelectElement>("#sizi-arayalim-ay")?.value).toBe("2026-12")

    const form = host.querySelector("form")
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    expect(sent?.get("when")).toBe("month")
    expect(sent?.get("month")).toBe("2026-12")
    expect(sent?.get("product_id")).toBe("prod_01TUR")
    expect(host.textContent).toContain("Talebiniz alındı, sizi arayacağız.")
  })
})

describe("the months a request may name", () => {
  it("starts with this month in the shop's zone and runs a year", () => {
    const months = requestMonths("Europe/Istanbul", new Date("2026-12-31T22:30:00Z"))
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ value: "2027-01", label: "Ocak 2027" })
    expect(months[11]?.value).toBe("2027-12")
  })
})
