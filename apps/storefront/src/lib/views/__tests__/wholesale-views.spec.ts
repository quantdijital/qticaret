import { describe, expect, it } from "vitest"
import type { PriceDisplay, StoreVariant } from "@qticaret/types"
import type { Cart } from "@/lib/cart/cart"
import type { CheckoutCart } from "@/lib/checkout/cart"
import { t } from "@/lib/i18n"
import { wholesaleDisplay } from "@/lib/store-api/wholesale-prices"
import { cartLinesOf, miniCartOf } from "../cart"
import { lineNetOf, netTotalsOf, taxLinesOf } from "../cart-tax"
import { summaryOf } from "../checkout-summary"
import { filterViews } from "../facets"
import type { ListingState } from "../listing"
import { offersOf } from "../cart-extras"
import { cardPrice, isVatExclusive, paidAmount, variantPrice } from "../price"
import { markWholesale } from "../wholesale-displays"

const variant = (id: string, amount: number): StoreVariant =>
  ({ id, calculated_price: { calculated_amount: amount } }) as StoreVariant

const RETAIL: PriceDisplay = {
  current: "100.00",
  regular: "120.00",
  before: "120.00",
  on_sale: true,
  since: null,
  basis: "lowest_30d",
  rule_version: "tr-10d-1",
  cart_offer: { type: "percentage", value: 10, minimum: null },
}

const WHOLESALE = wholesaleDisplay({ net: "66.67", gross: "80.00" })

/** ADR-0068 §5–§7: a wholesaler's prices without KDV; everyone else's as they were. */
describe("a price as the views show it", () => {
  it("keeps a retail price exactly as before: struck price, badge, offer, no note", () => {
    expect(variantPrice(variant("v1", 100), { v1: RETAIL }, t)).toEqual({
      current: "100,00 TL",
      before: "120,00 TL",
      from: false,
      discount: 16,
      saving: "20,00 TL",
      cartOffer: "Sepette %10 indirim",
    })
  })

  it("shows a wholesaler one price without KDV and says so, nothing struck", () => {
    expect(variantPrice(variant("v1", 80), { v1: WHOLESALE }, t)).toEqual({
      current: "66,67 TL",
      before: null,
      from: false,
      discount: null,
      saving: null,
      taxNote: "Toptan fiyat · KDV hariç",
    })
    const card = cardPrice([variant("v1", 80), variant("v2", 90)], {
      v1: WHOLESALE,
      v2: wholesaleDisplay({ net: "75.00", gross: "90.00" }),
    })
    expect(card).toMatchObject({
      current: "66,67 TL",
      from: true,
      taxNote: "Toptan fiyat · KDV hariç",
    })
  })

  it("gives a wholesaler's variant without a display no price at all (review L2)", () => {
    const own = markWholesale<Record<string, PriceDisplay>>({ v1: WHOLESALE })
    const bare = variant("v2", 80)
    expect(variantPrice(bare, own, t)).toBeNull()
    expect(paidAmount(bare, own)).toBeNull()
    expect(isVatExclusive(bare, own)).toBe(true)
    expect(cardPrice([variant("v1", 80), bare], own)).toMatchObject({ current: "66,67 TL" })
    // Anyone else's falls back to Medusa's price as before
    expect(variantPrice(bare, { v1: RETAIL }, t)).toMatchObject({ current: "80,00 TL" })
    expect(offersOf(own, t)).toEqual([])
  })

  it("pays a wholesaler's KDV-included amount for what follows the money", () => {
    expect(paidAmount(variant("v1", 80), { v1: WHOLESALE })).toBe(80)
    expect(paidAmount(variant("v1", 100), { v1: RETAIL })).toBe(100)
    expect(isVatExclusive({ id: "v1" }, { v1: WHOLESALE })).toBe(true)
    expect(isVatExclusive({ id: "v1" }, { v1: RETAIL })).toBe(false)
  })
})

// Medusa's totals for one line of 2 × 80.00 (KDV 20% in): 133.33 without, 26.67 KDV
const cart = (taxed: boolean) =>
  ({
    id: "cart_1",
    currency_code: "try",
    email: null,
    completed_at: null,
    shipping_address: null,
    shipping_methods: [],
    promotions: [],
    original_item_total: 160,
    item_total: 160,
    shipping_total: 0,
    total: 160,
    ...(taxed ? { item_subtotal: 133.33, item_tax_total: 26.67 } : {}),
    items: [
      {
        id: "cali_1",
        title: "Bıçak",
        subtitle: null,
        variant_title: null,
        thumbnail: null,
        quantity: 2,
        unit_price: 80,
        total: 160,
        original_total: 160,
        ...(taxed ? { tax_total: 26.67 } : {}),
      },
    ],
  }) as unknown as Cart & CheckoutCart

describe("a wholesaler's cart without KDV", () => {
  it("sets Medusa's totals side by side, nothing priced here", () => {
    const totals = netTotalsOf(cart(true))
    expect(totals).toEqual({ items: 13_333, discount: 0, vat: 2667, net: 13_333 })
    expect(totals && taxLinesOf(totals, "not")).toEqual({
      items: "133,33 TL",
      vat: "26,67 TL",
      note: "not",
    })
    expect(netTotalsOf(cart(false))).toBeNull()
    expect(lineNetOf({ total: 160, tax_total: 26.67 })).toBe(133.33)
  })

  it("shows the lines without KDV, said so, only for the wholesaler", () => {
    const [retail] = cartLinesOf(cart(true))
    expect(retail).not.toHaveProperty("taxNote")
    expect(retail?.total).toBe("160,00 TL")
    const [own] = cartLinesOf(cart(true), new Map(), new Map(), "KDV hariç")
    expect(own).toMatchObject({ total: "133,33 TL", original: null, taxNote: "KDV hariç" })
  })

  it("draws the drawer's subtotal without KDV for the wholesaler, free shipping on the paid amount", () => {
    expect(miniCartOf(cart(true), 150, t)).not.toHaveProperty("taxNote")
    const own = miniCartOf(cart(true), 150, t, new Map(), new Map(), true)
    expect(own).toMatchObject({ subtotal: "133,33 TL", freeShipping: { reached: true } })
    expect(own?.taxNote).toBe(t("cart.drawer_wholesale_note"))
  })

  it("adds the KDV line to the checkout's basket for the wholesaler only, the total Medusa's", () => {
    const retail = summaryOf(cart(true), t)
    expect(retail).not.toHaveProperty("tax")
    expect(retail.total).toBe("160,00 TL")
    const own = summaryOf(cart(true), t, new Map(), new Map(), true)
    expect(own.tax).toEqual({
      items: "133,33 TL",
      vat: "26,67 TL",
      note: t("checkout.wholesale_note"),
    })
    expect(own.lines[0]?.total).toBe("133,33 TL")
    expect(own.total).toBe("160,00 TL")
  })
})

describe("a wholesaler's listing filters", () => {
  const facets = { brands: [], attributes: [], price: { min: 100, max: 900 } }

  it("offers no price range to a wholesaler, a chosen one still removable", () => {
    const plain: ListingState = { filters: [], price: null, sort: null, page: 1 }
    expect(filterViews("/k", plain, facets, false, t).price).not.toBeNull()
    expect(filterViews("/k", plain, facets, false, t, undefined, false).price).toBeNull()
    const chosen: ListingState = { ...plain, price: { min: 100, max: 500 } }
    const views = filterViews("/k", chosen, facets, false, t, undefined, false)
    expect(views.price).toBeNull()
    expect(views.active).toHaveLength(1)
  })
})
