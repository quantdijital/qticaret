import type { ICartModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { eraseAddonTexts } from "../../src/workflows/addons/kvkk"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import { BANK_TRANSFER, orderLines } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

type Answer = { message?: string } & Record<string, unknown>
interface Addon {
  id: string
  kind: string
  choices?: { id: string; label: string; price: number }[]
}
interface Line {
  id: string
  unit_price: number
  compare_at_unit_price: number | null
  is_custom_price: boolean
  metadata: Record<string, unknown> | null
}
type LineRow = Omit<Line, "unit_price" | "compare_at_unit_price"> & {
  unit_price: unknown
  compare_at_unit_price: unknown
}

const ADDONS = [
  {
    kind: "text",
    label: "Ürün üzerine yazı",
    price: 35,
    max_quantity: 10,
    non_withdrawable: true,
    text: { max_length: 50 },
  },
  {
    kind: "choice",
    label: "Kılıf",
    choices: [
      { label: "Desenli Siyah", price: 300 },
      { label: "Desensiz Siyah", price: 250 },
    ],
  },
]

let made = 0

async function cartLine(container: MedusaContainer, cartId: string): Promise<Line> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: [
      "items.id",
      "items.unit_price",
      "items.compare_at_unit_price",
      "items.is_custom_price",
      "items.metadata",
    ],
    filters: { id: cartId },
  })
  const line = (data[0] as { items: LineRow[] }).items[0]
  if (!line) {
    throw new Error("the cart has no line")
  }
  return {
    ...line,
    unit_price: Number(line.unit_price),
    compare_at_unit_price:
      line.compare_at_unit_price === null ? null : Number(line.compare_at_unit_price),
  }
}

/** adr/0052: product add-ons, priced on the server, through checkout, returns and KVKK. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const flag = (enabled: boolean) => staff("/admin/features/catalog.addons", { enabled })
    const post = (url: string, body: unknown, headers: Record<string, string> = store.headers) =>
      settle(http.post<Answer>(url, body, { headers }))
    const pick = (cartId: string, lineId: string, body: unknown) =>
      post(`/store/carts/${cartId}/line-items/${lineId}/addons`, body)
    const startPayment = (cartId: string) =>
      post(`/store/carts/${cartId}/payment-session`, { provider_id: BANK_TRANSFER })

    /** A product at 1.000 TL with the two add-ons saved; their ids as saved. */
    const addonProduct = async () => {
      const product = await stockedProduct(
        getContainer(),
        shop,
        `caki-ek-${String((made += 1))}`,
        50,
        1000
      )
      const saved = await staff(`/admin/products/${product.productId}/catalog`, { addons: ADDONS })
      const addons = (saved.data["addons"] ?? []) as Addon[]
      const [text, choice] = addons
      const picks = [
        { addon_id: text?.id, value: "  Ahmet  Yılmaz " },
        { addon_id: choice?.id, choice_id: choice?.choices?.[0]?.id },
      ]
      return { ...product, saved, addons, picks }
    }
    const addonCart = async (variantId: string, quantity = 2) => {
      const cartId = await readyCart(getContainer(), shop, variantId, undefined, quantity)
      return { cartId, lineId: (await cartLine(getContainer(), cartId)).id }
    }

    const relaxed = process.env["RATE_LIMIT_RELAXED"]
    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await staff("/admin/platform-settings/bank_transfer", {
        enabled: true,
        account_holder: "Örnek Ticaret A.Ş.",
        bank_name: "Örnek Bankası",
        iban: "TR330006100519786457841326",
        deadline_hours: 24,
      })
    })
    // Flags live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      process.env["RATE_LIMIT_RELAXED"] = relaxed
      if (relaxed === undefined) {
        delete process.env["RATE_LIMIT_RELAXED"]
      }
      await flag(false)
      await staff("/admin/features/promotions.gift_cards", { enabled: false })
    })

    it("keeps add-ons behind the flag and saves them checked, with ids", async () => {
      const product = await stockedProduct(getContainer(), shop, "kapali-ek", 5, 100)
      const off = await staff(`/admin/products/${product.productId}/catalog`, { addons: ADDONS })
      const offRead = await settle(
        http.get(`/store/products/${product.productId}/addons`, { headers: store.headers })
      )
      await flag(true)
      const paidRequired = await staff(`/admin/products/${product.productId}/catalog`, {
        addons: [{ ...ADDONS[0], required: true }],
      })
      const six = await staff(`/admin/products/${product.productId}/catalog`, {
        addons: Array.from({ length: 6 }, () => ADDONS[0]),
      })
      const saved = await staff(`/admin/products/${product.productId}/catalog`, { addons: ADDONS })
      const read = await settle(
        http.get<{ addons: Addon[] }>(`/store/products/${product.productId}/addons`, {
          headers: store.headers,
        })
      )

      expect([off.status, off.data.message]).toEqual([400, "catalog.addons_disabled"])
      expect(offRead.status).toBe(404)
      expect([paidRequired.status, paidRequired.data.message]).toEqual([
        400,
        "addons.required_must_be_free",
      ])
      expect([six.status, six.data.message]).toEqual([400, "addons.too_many"])
      expect(saved.status).toBe(200)
      expect(saved.data["addons"]).toEqual([
        expect.objectContaining({
          id: expect.any(String) as unknown,
          kind: "text",
          price: 35,
          required: false,
        }) as unknown,
        expect.objectContaining({ id: expect.any(String) as unknown, kind: "choice" }) as unknown,
      ])
      expect(read.data.addons).toEqual(saved.data["addons"])
    })

    it("prices a line's picks on the server and never takes a price from the shopper", async () => {
      await flag(true)
      const { variantId, picks, addons } = await addonProduct()
      const { cartId, lineId } = await addonCart(variantId)

      const unknownChoice = await pick(cartId, lineId, {
        selections: [{ addon_id: addons[1]?.id, choice_id: "ch_yok" }],
      })
      const link = await pick(cartId, lineId, {
        selections: [{ addon_id: addons[0]?.id, value: "https://kotu.example" }],
      })
      const priced = await pick(cartId, lineId, { selections: picks, unit_price: 1 })
      const picked = await pick(cartId, lineId, { selections: picks })
      const line = await cartLine(getContainer(), cartId)
      const locked = await post(`/store/carts/${cartId}/line-items/${lineId}`, {
        quantity: 2,
        metadata: { not: "allowed" },
      })
      const tooMany = await post(`/store/carts/${cartId}/line-items/${lineId}`, { quantity: 11 })
      const more = await post(`/store/carts/${cartId}/line-items/${lineId}`, { quantity: 3 })
      const afterMore = await cartLine(getContainer(), cartId)
      await staff("/admin/features/promotions.gift_cards", { enabled: true })
      const giftPrice = await post(`/store/carts/${cartId}/line-items/${lineId}/gift`, {
        recipient_email: "zeynep@example.com",
        unit_price: 1,
      })
      const cleared = await pick(cartId, lineId, { selections: [] })
      const reset = await cartLine(getContainer(), cartId)

      expect([unknownChoice.status, unknownChoice.data.message]).toEqual([400, "addons.unknown"])
      expect([link.status, link.data.message]).toEqual([400, "addons.text_link"])
      expect(priced.status).toBe(400)
      expect(picked.status).toBe(200)
      expect(picked.data["line"]).toMatchObject({ unit_price: 1335, is_custom_price: true })
      // 1.000 + 35 + 300, the text as the server cleaned it
      expect(line).toMatchObject({ unit_price: 1335, is_custom_price: true })
      expect(line.metadata?.["qt_addons"]).toEqual({
        base: 1000,
        non_withdrawable: true,
        max_quantity: 10,
        items: [
          expect.objectContaining({
            kind: "text",
            label: "Ürün üzerine yazı",
            value: "Ahmet Yılmaz",
            amount: 35,
            non_withdrawable: true,
          }),
          expect.objectContaining({
            kind: "choice",
            label: "Kılıf",
            choice_label: "Desenli Siyah",
            amount: 300,
            non_withdrawable: false,
          }),
        ],
      })
      expect([locked.status, locked.data.message]).toEqual([400, "addons.line_locked"])
      expect([tooMany.status, tooMany.data.message]).toEqual([400, "addons.max_quantity"])
      expect(more.status).toBe(200)
      expect(afterMore.unit_price).toBe(1335)
      expect(giftPrice.status).toBe(400)
      expect(cleared.status).toBe(200)
      expect(reset).toMatchObject({ unit_price: 1000, is_custom_price: false })
      expect(reset.metadata ?? {}).not.toHaveProperty("qt_addons")
    })

    it("prices from the signed-in customer's group price list", async () => {
      await flag(true)
      const { variantId, picks } = await addonProduct()
      const customer = await registerCustomer(http, store)
      const group = await staff("/admin/customer-groups", { name: "Toptan" })
      const groupId = (group.data["customer_group"] as { id: string }).id
      await staff(`/admin/customer-groups/${groupId}/customers`, { add: [customer.id] })
      await staff("/admin/price-lists", {
        title: "Toptan",
        description: "",
        status: "active",
        type: "override",
        rules: { "customer.groups.id": [groupId] },
        prices: [{ variant_id: variantId, currency_code: "try", amount: 700 }],
      })
      const { cartId, lineId } = await addonCart(variantId, 1)
      await getContainer()
        .resolve<ICartModuleService>(Modules.CART)
        .updateCarts(cartId, { customer_id: customer.id })

      const picked = await pick(cartId, lineId, { selections: picks })

      expect(picked.data["line"]).toMatchObject({ unit_price: 1035 })
    })

    it("lets a code's discount cover the whole line, add-ons included (adr/0052 §6)", async () => {
      await flag(true)
      const { variantId, picks } = await addonProduct()
      await staff("/admin/promotions", {
        code: "EKLI10",
        type: "standard",
        is_automatic: false,
        is_tax_inclusive: true,
        status: "active",
        application_method: {
          type: "percentage",
          target_type: "order",
          allocation: "across",
          value: 10,
        },
      })
      const { cartId, lineId } = await addonCart(variantId, 1)
      await post(`/store/carts/${cartId}/promotions`, { promo_codes: ["EKLI10"] })
      // Picked after the code: Medusa's refresh puts the discount on the new price
      await pick(cartId, lineId, { selections: picks })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "cart",
          fields: ["items.adjustments.amount", "items.adjustments.code"],
          filters: { id: cartId },
        })
      const adjustments = (
        data[0] as { items: { adjustments: { amount: unknown; code: string }[] }[] }
      ).items[0]?.adjustments

      expect(adjustments?.map((each) => [each.code, Number(each.amount)])).toEqual([
        ["EKLI10", 133.5],
      ])
    })

    it("puts a stale line at its price now before the payment, and checks it at completion", async () => {
      await flag(true)
      const { variantId, picks, productId, addons } = await addonProduct()
      const list = await staff("/admin/price-lists", {
        title: "Kampanya",
        description: "",
        status: "active",
        type: "sale",
        prices: [{ variant_id: variantId, currency_code: "try", amount: 800 }],
      })
      const listId = (list.data["price_list"] as { id: string }).id
      const { cartId, lineId } = await addonCart(variantId, 1)
      await pick(cartId, lineId, { selections: picks })
      const onSale = await cartLine(getContainer(), cartId)
      await settle(http.delete(`/admin/price-lists/${listId}`, { headers: admin.headers }))

      const stale = await startPayment(cartId)
      const repriced = await cartLine(getContainer(), cartId)
      const started = await startPayment(cartId)
      // The add-on's price changes after the payment started
      await staff(`/admin/products/${productId}/catalog`, {
        addons: addons.map((addon, index) => ({
          ...ADDONS[index],
          id: addon.id,
          ...(addon.kind === "text" ? { price: 40 } : { choices: addon.choices }),
        })),
      })
      const moved = await post(`/store/carts/${cartId}/complete`, {})
      const again = await startPayment(cartId)
      const restarted = await startPayment(cartId)
      const placed = await post(`/store/carts/${cartId}/complete`, {})
      const order = placed.data["order"] as { id: string } | undefined
      const [sold] = await orderLines(getContainer(), order?.id ?? "")
      await flag(false)
      const other = await addonCart(variantId, 1)
      const offPick = await pick(other.cartId, other.lineId, { selections: picks })

      // 800 + 335 on sale, the list's price before it crossed out
      expect(onSale).toMatchObject({ unit_price: 1135, compare_at_unit_price: 1335 })
      expect([stale.status, stale.data.message]).toEqual([409, "cart.prices_changed"])
      expect(repriced).toMatchObject({ unit_price: 1335, is_custom_price: true })
      expect(started.status).toBe(200)
      expect([moved.status, moved.data.message]).toEqual([409, "cart.prices_changed"])
      expect([again.status, again.data.message]).toEqual([409, "cart.prices_changed"])
      expect(restarted.status).toBe(200)
      expect(placed.status).toBe(200)
      expect((sold?.metadata as Record<string, unknown>)["qt_addons"]).toMatchObject({
        base: 1000,
        items: [expect.objectContaining({ value: "Ahmet Yılmaz", amount: 40 }), expect.anything()],
      })
      expect(offPick.status).toBe(404)
    })

    it("takes a made-to-wish line back only as faulty, and erases its text", async () => {
      await flag(true)
      const container = getContainer()
      const { variantId, picks } = await addonProduct()
      const customer = await registerCustomer(http, store)
      const { cartId, lineId } = await addonCart(variantId, 1)
      await pick(cartId, lineId, { selections: picks })
      await startPayment(cartId)
      const placed = await post(`/store/carts/${cartId}/complete`, {})
      const orderId = (placed.data["order"] as { id: string }).id
      await container.resolve(Modules.ORDER).updateOrders(orderId, { customer_id: customer.id })
      const [line] = await orderLines(container, orderId)
      const items = [{ id: line?.id ?? "", quantity: 1 }]
      const { result: parcel } = await createOrderFulfillmentWorkflow(container).run({
        input: { order_id: orderId, items },
      })
      await createOrderShipmentWorkflow(container).run({
        input: { order_id: orderId, fulfillment_id: parcel.id, items },
      })
      const ask = (reason: string) =>
        post(
          `/store/orders/${orderId}/returns`,
          { items: [{ line_item_id: line?.id, quantity: 1 }], reason },
          customer.headers
        )

      const changedMind = await ask("changed_mind")
      const faulty = await ask("damaged")
      await eraseAddonTexts(container, [orderId])
      const [erased] = await orderLines(container, orderId)
      const cart = await cartLine(container, cartId)

      expect([changedMind.status, changedMind.data.message]).toEqual([
        400,
        "returns.withdrawal_excluded",
      ])
      expect(faulty.status).toBe(200)
      expect(JSON.stringify(erased?.metadata)).not.toContain("Ahmet")
      expect((erased?.metadata as Record<string, unknown>)["qt_addons"]).toMatchObject({
        items: [expect.objectContaining({ value: "—", amount: 35 }), expect.anything()],
      })
      expect(JSON.stringify(cart.metadata)).not.toContain("Ahmet")
    })
  },
})
