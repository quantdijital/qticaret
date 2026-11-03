import { describe, expect, it } from "vitest"
import type { StoreProductAddon } from "@qticaret/types"
import { t } from "@/lib/i18n"
import type { Cart } from "@/lib/cart/cart"
import type { StoreOrder } from "@/lib/orders/order"
import { addonFieldsOf, addonFormOf, lineAddonsOf } from "../addons"
import { cartLinesOf, withAddonForms } from "../cart"
import { orderView } from "../order"

/** The first shop's two add-ons (adr/0052 §12), as `GET /store/products/:id/addons` gives them. */
const ADDONS: StoreProductAddon[] = [
  {
    id: "ad_yazi",
    kind: "text",
    label: "Ürün üzerine yazı",
    help: "Bıçağın sapına işlenir.",
    required: false,
    max_quantity: 10,
    non_withdrawable: true,
    price: 35,
    text: { max_length: 50, charset: "letters_digits" },
  },
  {
    id: "ad_kilif",
    kind: "choice",
    label: "Kılıf",
    help: null,
    required: false,
    max_quantity: null,
    non_withdrawable: false,
    choices: [
      { id: "ch_desenli_siyah", label: "Desenli Siyah", price: 300 },
      { id: "ch_bez", label: "Bez kese", price: 0 },
    ],
  },
]

/** A line's record as the backend writes it (`metadata.qt_addons`). */
const RECORDED = {
  qt_addons: {
    items: [
      {
        addon_id: "ad_yazi",
        kind: "text",
        label: "Ürün üzerine yazı",
        value: "Ahmet Yılmaz",
        amount: 35,
        non_withdrawable: true,
      },
      {
        addon_id: "ad_kilif",
        kind: "choice",
        label: "Kılıf",
        choice_id: "ch_desenli_siyah",
        choice_label: "Desenli Siyah",
        amount: 300,
        non_withdrawable: false,
      },
    ],
    base: 1000,
    non_withdrawable: true,
    max_quantity: 10,
  },
}

describe("a line's add-on picks (adr/0052 §9)", () => {
  it("says each pick with its price per unit, and that the line is made to the buyer's wish", () => {
    expect(lineAddonsOf(RECORDED)).toEqual({
      addons: [
        {
          label: "Ürün üzerine yazı",
          value: "Ahmet Yılmaz",
          amount: "+35,00 TL",
          nonWithdrawable: true,
        },
        { label: "Kılıf", value: "Desenli Siyah", amount: "+300,00 TL", nonWithdrawable: false },
      ],
      nonWithdrawable: true,
      maxQuantity: 10,
    })
  })

  it("shows a free pick without a price, an erased text as the backend left it", () => {
    const { addons, nonWithdrawable, maxQuantity } = lineAddonsOf({
      qt_addons: {
        items: [
          {
            addon_id: "ad_kilif",
            kind: "choice",
            label: "Kılıf",
            choice_label: "Bez kese",
            amount: 0,
          },
          { addon_id: "ad_yazi", kind: "text", label: "Ürün üzerine yazı", value: "—", amount: 35 },
        ],
        max_quantity: null,
      },
    })
    expect(addons.map((addon) => [addon.value, addon.amount])).toEqual([
      ["Bez kese", null],
      ["—", "+35,00 TL"],
    ])
    expect([nonWithdrawable, maxQuantity]).toEqual([false, null])
  })

  it("reads anything else as no picks, never as an error", () => {
    const none = { addons: [], nonWithdrawable: false, maxQuantity: null }
    expect(lineAddonsOf(null)).toEqual(none)
    expect(lineAddonsOf({ qt_gift: { recipient_email: "a@b.co" } })).toEqual(none)
    expect(lineAddonsOf({ qt_addons: "" })).toEqual(none)
    expect(lineAddonsOf({ qt_addons: { items: [null, 5, { kind: "text" }] } }).addons).toEqual([])
  })
})

describe("a product's add-ons as fields", () => {
  it("words each price per unit and a text's rules; kuruş only feed the running total", () => {
    const [text, choice] = addonFieldsOf(ADDONS, t)
    expect(text).toMatchObject({
      id: "ad_yazi",
      kind: "text",
      price: "+35,00 TL",
      kurus: 3500,
      maxLength: 50,
      maxQuantity: 10,
      nonWithdrawable: true,
      rules: "En çok 50 karakter; yalnızca harf, rakam ve boşluk.",
      choices: [],
    })
    expect(choice?.choices).toEqual([
      { id: "ch_desenli_siyah", label: "Desenli Siyah", price: "+300,00 TL", kurus: 30000 },
      { id: "ch_bez", label: "Bez kese", price: null, kurus: 0 },
    ])
    expect(choice).toMatchObject({ price: null, kurus: 0, maxLength: null, rules: null })
  })

  it("re-opens a line's picks: the text typed and the choice's id, removable while none is required", () => {
    expect(addonFormOf("prod_1", ADDONS, RECORDED, t)).toMatchObject({
      productId: "prod_1",
      values: { ad_yazi: "Ahmet Yılmaz", ad_kilif: "ch_desenli_siyah" },
      missingRequired: false,
      removable: true,
    })
    const required = ADDONS.map((addon) =>
      addon.kind === "choice" ? { ...addon, required: true } : addon
    )
    // A plain line of a product with a required add-on: the form opens by itself
    expect(addonFormOf("prod_1", required, null, t)).toMatchObject({
      values: {},
      missingRequired: true,
      removable: false,
    })
    expect(addonFormOf("prod_1", [], RECORDED, t)).toBeNull()
  })
})

const cartLine = (id: string, metadata: Record<string, unknown> | null, productId = "prod_1") => ({
  id,
  title: "Çakı",
  subtitle: null,
  variant_title: "Siyah",
  thumbnail: null,
  quantity: 2,
  unit_price: 1335,
  total: 2670,
  original_total: 2670,
  product_id: productId,
  metadata,
})

describe("the cart's lines", () => {
  const cart: Cart = {
    id: "cart_1",
    currency_code: "try",
    original_item_total: 3670,
    item_total: 3670,
    total: 3670,
    completed_at: null,
    promotions: [],
    items: [cartLine("cali_1", RECORDED), cartLine("cali_2", null, "prod_2")],
  }

  it("carry their picks, the limit they set and the form only for a product with add-ons", () => {
    const [picked, plain] = withAddonForms(
      cartLinesOf(cart),
      cart,
      new Map([["prod_1", ADDONS]]),
      t
    )
    expect(picked).toMatchObject({ nonWithdrawable: true, maxQuantity: 10 })
    expect(picked?.addons).toHaveLength(2)
    expect(picked?.addonForm?.values).toEqual({
      ad_yazi: "Ahmet Yılmaz",
      ad_kilif: "ch_desenli_siyah",
    })
    expect(plain).toMatchObject({ addons: [], nonWithdrawable: false, maxQuantity: null })
    expect(plain).not.toHaveProperty("addonForm")
  })
})

const order = (metadata: Record<string, unknown> | null): StoreOrder => ({
  id: "order_1",
  display_id: 1001,
  email: "ayse@example.com",
  created_at: "2026-11-03T10:00:00.000Z",
  status: "pending",
  payment_status: "captured",
  fulfillment_status: "delivered",
  items: [{ ...cartLine("ordli_1", metadata), metadata }],
  original_item_total: 2670,
  item_total: 2670,
  shipping_total: 0,
  total: 2670,
  shipping_address: null,
})

describe("the order's lines", () => {
  it("show the picks as sold, and a line made to the buyer's wish comes back for a defect only", () => {
    const view = orderView(order(RECORDED), null, false, t)
    expect(view.lines[0]?.addons.map((addon) => addon.value)).toEqual([
      "Ahmet Yılmaz",
      "Desenli Siyah",
    ])
    expect(view.lines[0]?.nonWithdrawable).toBe(true)
    expect(view.returnable?.[0]).toMatchObject({ id: "ordli_1", excluded: "personal_addon" })
    expect(view.defectReasons).toEqual(["damaged", "wrong_item", "not_as_described"])
    // Every defect reason is one the form offers
    const offered = view.returnReasons.map((reason) => reason.value)
    expect(view.defectReasons?.every((reason) => offered.includes(reason))).toBe(true)
    expect(orderView(order(null), null, false, t).lines[0]).toMatchObject({
      addons: [],
      nonWithdrawable: false,
    })
  })
})
