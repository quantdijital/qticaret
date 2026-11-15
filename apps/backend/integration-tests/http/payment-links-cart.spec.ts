import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { completeWithSystemPayment } from "../helpers/checkout"
import { eventually } from "../helpers/eventually"
import { BANK_TRANSFER } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { linkBody, linkFlag, linkRow, linkShop, makeLink, tokenOf } from "../helpers/payment-links"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

interface CartRow {
  total: unknown
  discount_total: unknown
  metadata: Record<string, unknown> | null
  // Medusa's amounts and quantities as the query returns them
  items: { unit_price: unknown; quantity: unknown }[]
  promotions: { code: string }[]
  shipping_methods: { id: string }[]
}

interface Answer {
  cart_id?: string
  message?: string
}

/** adr/0051 §3–§5: a link opens a fresh cart at its prices; its order closes it as paid. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    let store: Storefront
    let shop: StockShop
    let product: { productId: string; variantId: string }

    const open = (token: string) =>
      settle(
        http.post<Answer>(`/store/payment-links/${token}/cart`, {}, { headers: store.headers })
      )
    const cartOf = async (id: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "cart",
          fields: [
            "total",
            "discount_total",
            "metadata",
            "items.unit_price",
            "items.quantity",
            "promotions.code",
            "shipping_methods.id",
          ],
          filters: { id },
        })
      return data[0] as unknown as CartRow
    }
    const complete = async (cartId: string) => {
      const { result: collection } = await createPaymentCollectionForCartWorkflow(
        getContainer()
      ).run({ input: { cart_id: cartId } })
      return completeWithSystemPayment(getContainer(), cartId, collection.id)
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      owner = await createAdminUser(http, container)
      product = await stockedProduct(container, shop, `bicak-${String(Date.now())}`, 10, 150)
      await linkShop(http, container, owner.headers)
    })
    afterEach(async () => {
      await linkFlag(http, owner.headers, false)
    })

    it("opens a cart at the link's prices with its hidden discount, locked; a second cart supersedes the first; the order pays the link", async () => {
      const made = await makeLink(
        http,
        owner.headers,
        linkBody(shop, product.variantId, {
          discount: { type: "percentage", value: 10, reason: "Instagram" },
        })
      )
      const id = made.data.payment_link?.id ?? ""
      const token = tokenOf(made.data.share?.url)
      const first = await open(token)
      const firstCart = await cartOf(first.data.cart_id ?? "")
      const added = await settle(
        http.post<Answer>(
          `/store/carts/${first.data.cart_id ?? ""}/line-items`,
          { variant_id: product.variantId, quantity: 1 },
          { headers: store.headers }
        )
      )
      const codeOff = await settle(
        http.delete<Answer>(`/store/carts/${first.data.cart_id ?? ""}/promotions`, {
          headers: store.headers,
          data: { promo_codes: firstCart.promotions.map((promotion) => promotion.code) },
        })
      )
      const second = await open(token)
      const secondId = second.data.cart_id ?? ""
      const oldStart = await settle(
        http.post<Answer>(
          `/store/carts/${first.data.cart_id ?? ""}/payment-session`,
          { provider_id: BANK_TRANSFER },
          { headers: store.headers }
        )
      )
      const oldOrder = await complete(first.data.cart_id ?? "")
      const order = await complete(secondId)
      const paid = await eventually(
        () => linkRow(getContainer(), id),
        (row) => row.status === "paid"
      )
      const { data: orders } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["metadata"], filters: { id: order.order_id ?? "" } })
      // The bell follows the paid mark: on a slow runner it can come a moment later
      const bells = await eventually(
        () =>
          (
            getContainer().resolve(Modules.NOTIFICATION) as unknown as {
              listNotifications: (filters: Record<string, unknown>) => Promise<unknown[]>
            }
          ).listNotifications({ resource_id: id, trigger_type: "payment_links.paid" }),
        (found) => found.length > 0
      )
      const reopened = await open(token)

      expect(first.status).toBe(200)
      expect(
        firstCart.items.map((item) => [Number(item.unit_price), Number(item.quantity)])
      ).toEqual([[150, 2]])
      expect(firstCart.promotions.map((promotion) => promotion.code)).toEqual([
        expect.stringMatching(/^PL-[2-9A-HJ-NP-Z]{12}$/),
      ])
      expect(Number(firstCart.discount_total)).toBe(30)
      expect(firstCart.metadata).toMatchObject({ qt_payment_link: id })
      expect(firstCart.shipping_methods).toHaveLength(1)
      expect(added.status).toBe(400)
      expect(added.data.message).toBe("cart.payment_link_locked")
      expect(codeOff.status).toBe(400)
      expect(second.status).toBe(200)
      expect(secondId).not.toBe(first.data.cart_id)
      expect(oldStart.status).toBe(400)
      expect(oldStart.data.message).toBe("cart.payment_link_superseded")
      expect(oldOrder).toEqual({ order_id: null, message: "cart.payment_link_superseded" })
      expect(order.order_id).toMatch(/^order_/)
      expect(paid).toMatchObject({ status: "paid", order_id: order.order_id, cart_id: secondId })
      expect((orders[0] as { metadata: Record<string, unknown> }).metadata).toMatchObject({
        qt_payment_link: id,
        // The number itself (PL-n), for the order's page without the link's recorded read
        qt_payment_link_number: paid.number,
        qt_payment_link_by: owner.userId,
      })
      expect(made.data.payment_link?.number).toBe(`PL-${String(paid.number)}`)
      expect(bells).toHaveLength(1)
      expect(reopened.status).toBe(404)
    })

    it("answers 409 when a price moved since the link was made, turns it to draft and tells staff", async () => {
      const made = await makeLink(http, owner.headers, linkBody(shop, product.variantId))
      const id = made.data.payment_link?.id ?? ""
      const moved = await settle(
        http.post(
          `/admin/products/${product.productId}/variants/${product.variantId}`,
          { prices: [{ currency_code: "try", amount: 175 }] },
          { headers: owner.headers }
        )
      )
      const refused = await open(tokenOf(made.data.share?.url))
      const shown = await settle(
        http.get<{ payment_link?: { state: string } }>(
          `/store/payment-links/${tokenOf(made.data.share?.url)}`,
          { headers: store.headers }
        )
      )
      const bells = await (
        getContainer().resolve(Modules.NOTIFICATION) as unknown as {
          listNotifications: (filters: Record<string, unknown>) => Promise<unknown[]>
        }
      ).listNotifications({ resource_id: id, trigger_type: "payment_links.prices_changed" })

      expect(moved.status).toBe(200)
      expect(refused.status).toBe(409)
      expect(refused.data.message).toBe("payment_link.prices_changed")
      expect((await linkRow(getContainer(), id)).status).toBe("draft")
      expect(shown.data.payment_link?.state).toBe("prices_changed")
      expect(bells).toHaveLength(1)
    })

    it("refuses a link's code on any other cart", async () => {
      const made = await makeLink(
        http,
        owner.headers,
        linkBody(shop, product.variantId, {
          discount: { type: "fixed", value: 2_000, reason: "Sadık müşteri" },
        })
      )
      const opened = await open(tokenOf(made.data.share?.url))
      const code = (await cartOf(opened.data.cart_id ?? "")).promotions[0]?.code ?? ""
      const other = await settle(
        http.post<{ cart: { id: string } }>(
          "/store/carts",
          {
            region_id: shop.regionId,
            items: [{ variant_id: product.variantId, quantity: 5 }],
            promo_codes: [code],
          },
          { headers: store.headers }
        )
      )
      const started = await settle(
        http.post<Answer>(
          `/store/carts/${other.data.cart.id}/payment-session`,
          { provider_id: BANK_TRANSFER },
          { headers: store.headers }
        )
      )

      expect(other.status).toBe(200)
      expect(started.status).toBe(400)
      expect(started.data.message).toBe("cart.payment_link_code_misused")
    })
  },
})
