import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type {
  CartLineView,
  CartPageView,
  CheckoutSummaryView,
  PriceView,
  ThemeActions,
} from "@qticaret/ui"
import { t } from "@/lib/i18n"
// The theme's own parts: it exports pages, not these
import { CartSummary } from "../../../../../packages/themes/atolye/src/cart/CartSummary"
import { CartLine } from "../../../../../packages/themes/atolye/src/cart/CartLine"
import { Summary } from "../../../../../packages/themes/atolye/src/checkout/Summary"
import { LinePrice } from "../../../../../packages/themes/atolye/src/parts/LinePrice"
import { Price } from "../../../../../packages/themes/atolye/src/parts/Price"
import { Price as BuyPrice } from "../../../../../packages/themes/atolye/src/product/Price"

/**
 * ADR-0068 slice 3 in the theme (adr/0066 K3(b)): new optional data only.
 * Every shopper but a wholesaler is drawn byte for byte as before (the
 * snapshots were written from `dev`'s components before the change); a
 * wholesaler's view carries a note and a KDV line, drawn only then.
 */

const actions = {
  applyPromotion: () => Promise.resolve({ ok: true, error: null }),
  removePromotion: () => Promise.resolve(),
} as unknown as ThemeActions

const RETAIL_PRICE: PriceView = {
  current: "100,00 TL",
  before: "120,00 TL",
  from: false,
  discount: 16,
  saving: "20,00 TL",
  cartOffer: "Sepette %10 indirim",
}

const WHOLESALE_PRICE: PriceView = {
  current: "66,67 TL",
  before: null,
  from: false,
  discount: null,
  saving: null,
  taxNote: "Toptan fiyat · KDV hariç",
}

const LINE: CartLineView = {
  id: "cali_1",
  title: "Av bıçağı",
  detail: null,
  quantity: 2,
  total: "160,00 TL",
  original: "180,00 TL",
  image: null,
  addons: [],
  nonWithdrawable: false,
}

const CART: CartPageView = {
  lines: [LINE],
  items: "180,00 TL",
  discount: "20,00 TL",
  subtotal: "160,00 TL",
  promotions: [],
  freeShipping: null,
  error: null,
}

const SUMMARY: CheckoutSummaryView = {
  lines: [
    {
      id: "cali_1",
      title: "Av bıçağı",
      detail: null,
      quantity: 2,
      total: "160,00 TL",
      image: null,
    },
  ],
  items: "160,00 TL",
  discount: null,
  shipping: "85,00 TL",
  total: "245,00 TL",
}

const TAX = { items: "133,33 TL", vat: "26,67 TL", note: "Ürün tutarları KDV hariçtir." }

const html = (node: React.ReactElement) => renderToStaticMarkup(node)

describe("every shopper but a wholesaler, drawn as before", () => {
  it("draws a card's and the buy column's price unchanged", () => {
    expect(html(<Price price={RETAIL_PRICE} t={t} />)).toMatchSnapshot()
    expect(
      html(
        <BuyPrice
          price={RETAIL_PRICE}
          words={{ before: "Önceki", saving: "{amount}", discount: {} }}
        />
      )
    ).toMatchSnapshot()
  })

  it("draws a cart line, the cart's totals and the checkout's basket unchanged", () => {
    expect(
      html(<LinePrice total="160,00 TL" original="180,00 TL" before="Önceki" />)
    ).toMatchSnapshot()
    expect(html(<CartLine line={LINE} t={t} actions={actions} locked={false} />)).toMatchSnapshot()
    expect(html(<CartSummary view={CART} t={t} actions={actions} />)).toMatchSnapshot()
    expect(html(<Summary summary={SUMMARY} t={t} />)).toMatchSnapshot()
  })
})

describe("a wholesaler's view", () => {
  it("says the price is the wholesale one without KDV, nothing struck", () => {
    const card = html(<Price price={WHOLESALE_PRICE} t={t} />)
    expect(card).toContain("Toptan fiyat · KDV hariç")
    expect(card).not.toContain("<s>")
    expect(card).not.toContain("<s ")
    const buy = html(
      <BuyPrice
        price={WHOLESALE_PRICE}
        words={{ before: "Önceki", saving: "{amount}", discount: {} }}
      />
    )
    expect(buy).toContain("Toptan fiyat · KDV hariç")
  })

  it("draws a line's total without KDV with its note", () => {
    const line = html(
      <CartLine
        line={{ ...LINE, original: null, total: "133,33 TL", taxNote: "KDV hariç" }}
        t={t}
        actions={actions}
        locked={false}
      />
    )
    expect(line).toContain("133,33 TL")
    expect(line).toContain("KDV hariç")
  })

  it("puts the KDV on its own line in the cart and the checkout, the totals Medusa's", () => {
    const cart = html(
      <CartSummary view={{ ...CART, discount: null, tax: TAX }} t={t} actions={actions} />
    )
    for (const text of [
      t("cart.items_net"),
      "133,33 TL",
      t("cart.vat"),
      "26,67 TL",
      "160,00 TL",
      TAX.note,
    ]) {
      expect(cart).toContain(text)
    }
    expect(cart).toContain(t("cart.subtotal_with_vat"))
    const checkout = html(<Summary summary={{ ...SUMMARY, tax: TAX }} t={t} />)
    for (const text of [
      t("cart.items_net"),
      "133,33 TL",
      t("cart.vat"),
      "26,67 TL",
      "245,00 TL",
      TAX.note,
    ]) {
      expect(checkout).toContain(text)
    }
    expect(checkout).not.toContain(t("checkout.tax_included"))
  })
})
