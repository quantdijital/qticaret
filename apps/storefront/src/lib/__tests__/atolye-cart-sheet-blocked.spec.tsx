import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { MiniCartView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
// The drawer opens in a portal the server never prints; its body is rendered on its own
import { CartSheetBody } from "../../../../../packages/themes/atolye/src/frame/CartSheet"
import { cartSheetWords } from "../../../../../packages/themes/atolye/src/frame/cart-sheet-words"

/**
 * The cart drawer's "Ödemeye geç" while the cart cannot go to the
 * payment (ADR-0068 §8): new optional data only (adr/0066). Without it
 * the drawer is drawn byte for byte as before (the snapshot was written
 * from `dev`'s components before the change).
 */

const nothing = (): Promise<void> => Promise.resolve()

const mini = (over: Partial<MiniCartView> = {}): MiniCartView => ({
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
  subtotal: "400,00 TL",
  freeShipping: null,
  ...over,
})

const drawer = (cart: MiniCartView) =>
  renderToStaticMarkup(
    <CartSheetBody
      cart={cart}
      categories={[]}
      change={nothing}
      words={cartSheetWords(t, cart.lines.length)}
    />
  )

describe("the cart drawer without a reason to stop", () => {
  it("is drawn as before, its checkout button a link", () => {
    const html = drawer(mini())
    expect(html).toMatchSnapshot()
    expect(html.match(/href="\/odeme"/g)).toHaveLength(1)
    expect(drawer(mini({ checkoutBlocked: null }))).toBe(html)
  })
})

describe("the cart drawer while the cart cannot go to the payment", () => {
  const REASON = "Toptan siparişte en az 10 adet gerekir; sepetinizde 4 adet var."
  const html = drawer(mini({ checkoutBlocked: { reason: REASON } }))

  it("draws its checkout button off, still reached by the keyboard, the cart link kept", () => {
    expect(html).not.toContain('href="/odeme"')
    expect(html).toContain('href="/sepet"')
    const button = /<button[^>]*>Ödemeye geç<\/button>/.exec(html)?.[0] ?? ""
    expect(button).toContain('type="button"')
    expect(button).toContain('aria-disabled="true"')
    expect(button).not.toMatch(/\sdisabled(=|\s|>)/)
  })

  it("says the reason under it, read when it is focused, under an id of its own", () => {
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1] ?? ""
    expect(id).toMatch(/-odeme-engeli$/)
    expect(html).toContain(`<p id="${id}"`)
    expect(html).toContain(`>${REASON}</p>`)
    // Not the cart page's ids: a page may hold both
    expect(id).not.toBe("odeme-engeli")
  })
})
