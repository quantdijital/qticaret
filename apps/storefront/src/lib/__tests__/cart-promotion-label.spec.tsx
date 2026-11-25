import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { CartLineView, ThemeActions } from "@qticaret/ui"
import type { Cart } from "@/lib/cart/cart"
import { t } from "@/lib/i18n"
import { cartLinesOf } from "@/lib/views/cart"
// The theme's own parts: it exports pages, not these
import { CartLine } from "../../../../../packages/themes/atolye/src/cart/CartLine"
import { CartSheetLine } from "../../../../../packages/themes/atolye/src/frame/CartSheetLine"
import { cartSheetWords } from "../../../../../packages/themes/atolye/src/frame/cart-sheet-words"

/**
 * adr/0076 Ek 2026-11-25 (the shop owner's decision): a cart line's struck
 * amount is what its promotions took off (Medusa's `original_total`; a
 * price list's sale is already the line's price), so it is read as
 * "Promosyon indirimi", never as a price before. Text only: the line's
 * markup is as it was.
 */

const actions = {} as unknown as ThemeActions

// A guest's cart of one line, as the store API answers it
const cart = (original: number, total: number) =>
  ({
    id: "cart_1",
    currency_code: "try",
    promotions: [],
    item_total: total,
    total,
    items: [
      {
        id: "cali_1",
        title: "Kapadokya turu",
        subtitle: null,
        variant_title: "Yetişkin",
        thumbnail: null,
        quantity: 1,
        unit_price: original,
        total,
        original_total: original,
        metadata: null,
      },
    ],
  }) as unknown as Cart

const lineOf = (original: number, total: number): CartLineView => {
  const [line] = cartLinesOf(cart(original, total))
  if (!line) {
    throw new Error("no line")
  }
  return line
}

const html = (node: ReactElement) => renderToStaticMarkup(node)

describe("a cart line's struck amount", () => {
  it("is set only when a promotion took something off the line", () => {
    // A departure's place at 1.750,50 with an automatic 20%: 1.400,40
    expect(lineOf(1750.5, 1400.4)).toMatchObject({ total: "1.400,40 TL", original: "1.750,50 TL" })
    // No promotion (a price list's sale is the unit price itself): nothing struck
    expect(lineOf(1500, 1500)).toMatchObject({ total: "1.500,00 TL", original: null })
  })

  it("reads as the promotion's discount on the cart page and in the drawer, never a price before", () => {
    const promoted = lineOf(1750.5, 1400.4)
    const page = html(<CartLine line={promoted} t={t} actions={actions} locked={false} />)
    const words = cartSheetWords(t, 1).line
    const drawer = html(<CartSheetLine line={promoted} change={undefined} locked words={words} />)
    for (const drawn of [page, drawer]) {
      expect(drawn).toContain(
        '<span class="sr-only">Promosyon indirimi öncesi: </span>1.750,50 TL</s>'
      )
      expect(drawn).not.toContain("Önceki fiyat")
    }
    expect(words.before).toBe("Promosyon indirimi öncesi:")
  })

  it("says nothing of a discount on a line without one", () => {
    const plain = lineOf(1500, 1500)
    const page = html(<CartLine line={plain} t={t} actions={actions} locked={false} />)
    const drawer = html(
      <CartSheetLine line={plain} change={undefined} locked words={cartSheetWords(t, 1).line} />
    )
    for (const drawn of [page, drawer]) {
      expect(drawn).not.toContain("<s ")
      expect(drawn).not.toContain("Promosyon indirimi")
    }
  })
})
