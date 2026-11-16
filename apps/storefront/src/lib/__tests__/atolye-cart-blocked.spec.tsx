import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ActionResult, CartPageView, ThemeActions } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"
// The theme's own lists: it exports pages, not these
import { promotionWords } from "../../../../../packages/themes/atolye/src/cart/code-words"
import { CHECKOUT_ERRORS } from "../../../../../packages/themes/atolye/src/checkout/errors"

/**
 * "Ödemeye geç" while the cart cannot go to the payment (ADR-0068 §8, a
 * wholesaler's cart short of its minimum): new optional data only
 * (adr/0066). Without it the page is drawn byte for byte as before (the
 * snapshot was written from `dev`'s components before the change). With
 * it, the wholesaler's refusals the theme now says in their own words.
 */

const done = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })
const nothing = (): Promise<void> => Promise.resolve()

const actions = {
  addToCart: done,
  changeCartLine: nothing,
  applyPromotion: done,
  removePromotion: nothing,
} as unknown as ThemeActions

const view = (over: Partial<CartPageView> = {}): CartPageView => ({
  lines: [
    {
      id: "cali_1",
      title: "Av bıçağı",
      detail: null,
      quantity: 4,
      total: "400,00 TL",
      original: null,
      image: null,
      addons: [],
      nonWithdrawable: false,
    },
  ],
  items: "400,00 TL",
  discount: null,
  subtotal: "400,00 TL",
  promotions: [],
  freeShipping: null,
  error: null,
  ...over,
})

const REASON = "Toptan siparişte en az 10 adet gerekir; sepetinizde 4 adet var."

describe("the cart page without a reason to stop", () => {
  it("is drawn as before, both checkout buttons links", () => {
    const html = renderPage(atolyeTheme, "CartPage", { view: view(), actions })
    expect(html).toMatchSnapshot()
    expect(html.match(/href="\/odeme"/g)).toHaveLength(2)
    expect(
      renderPage(atolyeTheme, "CartPage", { view: view({ checkoutBlocked: null }), actions })
    ).toBe(html)
  })
})

describe("the cart page while the cart cannot go to the payment", () => {
  const html = renderPage(atolyeTheme, "CartPage", {
    view: view({ checkoutBlocked: { reason: REASON } }),
    actions,
  })

  it("draws both checkout buttons off, no link to the payment", () => {
    expect(html).not.toContain('href="/odeme"')
    const buttons = [...html.matchAll(/<button[^>]*>Ödemeye geç<\/button>/g)].map((m) => m[0])
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      expect(button).toContain('type="button"')
      expect(button).toContain('aria-disabled="true"')
      // Off for a pointer, still reached by the keyboard
      expect(button).not.toMatch(/\sdisabled(=|\s|>)/)
    }
  })

  it("says the reason beside each, read when the button is focused", () => {
    for (const id of ["odeme-engeli", "odeme-engeli-telefon"]) {
      expect(html).toContain(`aria-describedby="${id}"`)
      expect(html).toContain(`<p id="${id}"`)
      expect(html).toMatch(new RegExp(`<p id="${id}"[^>]*>${REASON}</p>`))
    }
  })
})

describe("a wholesaler's refusals in the theme's words", () => {
  it("says a code is not taken on a wholesale order", () => {
    const words = promotionWords(t)
    expect(words.errors["promotions.wholesale_no_code"]).toBe(
      "Toptan siparişte indirim kodu kullanılamaz."
    )
    expect(words.errors["promotions.wholesale_no_code"]).not.toBe(words.fallback)
  })

  it("says a payment that could not start in its own words, not the form's fallback", () => {
    expect(CHECKOUT_ERRORS).toContain("wholesale.payment_unavailable")
    expect(t("wholesale.payment_unavailable")).toBe(
      "Sepetinizin ödemesi şu an başlatılamıyor. Sepetinizi yenileyip biraz sonra tekrar deneyin."
    )
    // A wholesale cart's stale prices are told in the cart's own words, which the form knows
    expect(CHECKOUT_ERRORS).toContain("cart.prices_changed")
  })
})
