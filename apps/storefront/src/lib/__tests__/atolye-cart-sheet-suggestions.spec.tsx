import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { MiniCartView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { CartSheetBody } from "../../../../../packages/themes/atolye/src/frame/CartSheet"
import { cartSheetWords } from "../../../../../packages/themes/atolye/src/frame/cart-sheet-words"

/**
 * The drawer's "Bunu da beğenebilirsiniz" (S3): new optional data only
 * (adr/0066). Without it the drawer is drawn as before; with it, each
 * suggestion is one link to its page, with its price.
 */

const nothing = (): Promise<void> => Promise.resolve()

const card = (id: string, title: string): ProductCardView => ({
  id,
  title,
  path: `/${id}`,
  brand: null,
  image: null,
  price: { current: "250,00 TL", before: null, from: false, discount: null },
  available: true,
})

const mini = (over: Partial<MiniCartView> = {}): MiniCartView => ({
  lines: [
    {
      id: "cali_1",
      title: "Av bıçağı",
      detail: null,
      quantity: 1,
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

describe("the cart drawer's suggestions", () => {
  it("are not drawn without any, the drawer as before", () => {
    const html = drawer(mini())
    expect(drawer(mini({ suggestions: null }))).toBe(html)
    expect(drawer(mini({ suggestions: { title: "x", products: [] } }))).toBe(html)
  })

  it("list each under the heading as one link to its page with its price", () => {
    const html = drawer(
      mini({
        suggestions: {
          title: t("cart.cross_sells"),
          products: [card("bileği-tasi", "Bileği taşı"), card("kilif", "Deri kılıf")],
        },
      })
    )
    expect(html).toContain("Bunu da beğenebilirsiniz")
    expect(html.match(/href="\/kilif"/g)).toHaveLength(2)
    expect(html.match(/href="\/kilif" tabindex="-1" aria-hidden="true"/g)).toHaveLength(1)
    expect(html).toContain("Deri kılıf")
    expect(html.match(/250,00 TL/g)).toHaveLength(2)
  })
})
