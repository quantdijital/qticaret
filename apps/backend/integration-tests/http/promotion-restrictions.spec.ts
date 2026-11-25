import { Modules, PromotionActions } from "@medusajs/framework/utils"
import {
  createPaymentCollectionForCartWorkflow,
  updateCartPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { completeWithSystemPayment } from "../helpers/checkout"
import { registerCustomer } from "../helpers/customer"
import { shippedCart } from "../helpers/gift-cards"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface Cart {
  id: string
  discount_total: number
  promotions?: { code: string }[]
}

const CART_FIELDS = "id,discount_total,*promotions"
const ADDRESS = { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" }

/** K1/K2: codes for some customer groups or a first order only, refused with why and at checkout. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    let variantId: string

    async function promotion(code: string, rules: Record<string, unknown>[]) {
      const made = await settle(
        http.post<{ promotion: { id: string } }>(
          "/admin/promotions",
          {
            code,
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
            rules,
          },
          { headers: admin.headers }
        )
      )
      expect(made.status).toBe(200)
      return made.data.promotion.id
    }

    const post = <T>(url: string, body: unknown, headers: Record<string, string> = store.headers) =>
      settle(http.post<T & { message?: string }>(url, body, { headers }))

    async function cart(
      headers: Record<string, string> = store.headers,
      extra: Record<string, unknown> = {}
    ) {
      const made = await post<{ cart: Cart }>(
        `/store/carts?fields=${CART_FIELDS}`,
        { region_id: shop.regionId, items: [{ variant_id: variantId, quantity: 1 }], ...extra },
        headers
      )
      expect(made.status).toBe(200)
      return made.data.cart
    }

    const addCode = (
      cartId: string,
      code: string,
      headers: Record<string, string> = store.headers
    ) =>
      post<{ cart: Cart }>(
        `/store/carts/${cartId}/promotions?fields=${CART_FIELDS}`,
        { promo_codes: [code] },
        headers
      )

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      shop = await stockShop(getContainer())
      variantId = (await stockedProduct(getContainer(), shop, "kisitli-kupa", 50)).variantId
    })

    it("gives a group's code to its members only, telling the others why", async () => {
      const group = await http.post<{ customer_group: { id: string } }>(
        "/admin/customer-groups",
        { name: "Sadık müşteriler" },
        { headers: admin.headers }
      )
      const groupId = group.data.customer_group.id
      await promotion("SADIK", [
        { attribute: "customer.groups.id", operator: "in", values: [groupId] },
      ])

      const guest = await addCode((await cart()).id, "sadik")
      expect(guest.status).toBe(400)
      expect(guest.data.message).toBe("promotions.customer_group_login")

      const member = await registerCustomer(http, store)
      const memberCart = await cart(member.headers)
      const outsider = await addCode(memberCart.id, "sadik", member.headers)
      expect(outsider.status).toBe(400)
      expect(outsider.data.message).toBe("promotions.customer_group_only")

      await http.post(
        `/admin/customer-groups/${groupId}/customers`,
        { add: [member.id] },
        { headers: admin.headers }
      )
      const taken = await addCode(memberCart.id, "sadik", member.headers)
      expect(taken.status).toBe(200)
      expect(taken.data.cart.promotions?.map((each) => each.code)).toEqual(["SADIK"])
      expect(taken.data.cart.discount_total).toBe(10)
    })

    it("gives a first-order code to new buyers only, by customer and by e-mail", async () => {
      await promotion("ILK", [{ attribute: "first_order", operator: "in", values: ["true"] }])

      // A guest with no e-mail yet, and a new e-mail: the code is taken
      const unknown = await addCode((await cart()).id, "ilk")
      expect(unknown.status).toBe(200)
      expect(unknown.data.cart.discount_total).toBe(10)
      const fresh = await addCode(
        (await cart(store.headers, { email: "yeni@example.com" })).id,
        "ilk"
      )
      expect(fresh.status).toBe(200)
      expect(fresh.data.cart.discount_total).toBe(10)

      await placeOrder(getContainer(), {
        ...shop,
        items: [{ variant_id: variantId, quantity: 1 }],
        email: "eski_musteri@example.com",
        address: ADDRESS,
      })
      // However the address is written; `_` is a letter, not a wildcard
      const again = await addCode(
        (await cart(store.headers, { email: "Eski_Musteri@example.com" })).id,
        "ilk"
      )
      expect(again.status).toBe(400)
      expect(again.data.message).toBe("promotions.first_order_only")
      const lookalike = await addCode(
        (await cart(store.headers, { email: "eskiXmusteri@example.com" })).id,
        "ilk"
      )
      expect(lookalike.status).toBe(200)

      // A guest's code taken before the e-mail comes off when it names a returning buyer
      const early = await cart()
      expect((await addCode(early.id, "ilk")).status).toBe(200)
      const named = await post<{ cart: Cart }>(`/store/carts/${early.id}?fields=${CART_FIELDS}`, {
        email: "eski_musteri@example.com",
      })
      expect(named.status).toBe(200)
      expect(named.data.cart.promotions ?? []).toEqual([])
      expect(named.data.cart.discount_total).toBe(0)
    })

    it("refuses a first-order code at checkout once the buyer has ordered", async () => {
      await promotion("ILK", [{ attribute: "first_order", operator: "in", values: ["true"] }])
      const customer = await registerCustomer(http, store)
      const id = await shippedCart(getContainer(), shop, variantId, customer.id)
      await updateCartPromotionsWorkflow(getContainer()).run({
        input: { cart_id: id, promo_codes: ["ILK"], action: PromotionActions.ADD },
      })
      // Another cart of the same buyer is placed first (two tabs, a race)
      await placeOrder(getContainer(), {
        ...shop,
        items: [{ variant_id: variantId, quantity: 1 }],
        email: customer.email,
        address: ADDRESS,
      })
      const { result: collection } = await createPaymentCollectionForCartWorkflow(
        getContainer()
      ).run({ input: { cart_id: id } })
      const refused = await completeWithSystemPayment(getContainer(), id, collection.id)
      expect(refused).toEqual({ order_id: null, message: "promotions.first_order_only" })
    })

    it("saves who may use a promotion from the panel's form, and nothing else that way", async () => {
      const id = await promotion("FORM", [
        { attribute: "item_total", operator: "gte", values: ["100"] },
      ])
      const body = (audience: unknown[]) => ({
        promotion: { code: "FORM", is_automatic: false, limit: null },
        audience,
      })
      const saved = await settle(
        http.post(
          `/admin/promotions/${id}/offer`,
          body([
            { attribute: "customer.groups.id", operator: "in", values: ["cusgroup_1"] },
            { attribute: "first_order", operator: "in", values: ["true"] },
          ]),
          { headers: admin.headers }
        )
      )
      expect(saved.status).toBe(200)
      const rulesOf = async () => {
        const [read] = await getContainer()
          .resolve(Modules.PROMOTION)
          .listPromotions({ id: [id] }, { relations: ["rules"] })
        return (read?.rules ?? []).map((rule) => rule.attribute).sort()
      }
      expect(await rulesOf()).toEqual(["customer.groups.id", "first_order", "item_total"])

      // Back to everyone: the minimum stays
      await http.post(`/admin/promotions/${id}/offer`, body([]), { headers: admin.headers })
      expect(await rulesOf()).toEqual(["item_total"])

      for (const audience of [
        [{ attribute: "item_total", operator: "in", values: ["1"] }],
        [{ attribute: "first_order", operator: "in", values: ["false"] }],
      ]) {
        const refused = await settle(
          http.post(`/admin/promotions/${id}/offer`, body(audience), { headers: admin.headers })
        )
        expect(refused.status).toBe(400)
      }
      expect(await rulesOf()).toEqual(["item_total"])
    })
  },
})
