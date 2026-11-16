import { Modules } from "@medusajs/framework/utils"
import { createPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { settlePaymentLinks } from "../../src/workflows/payment-links/settle"
import { createAdminUser } from "../helpers/admin"
import { completeWithSystemPayment } from "../helpers/checkout"
import { eventually } from "../helpers/eventually"
import { BANK_TRANSFER } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import {
  linkBody,
  linkFlag,
  linkRow,
  linkShop,
  linksOf,
  makeLink,
  tokenOf,
} from "../helpers/payment-links"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

interface Answer {
  cart_id?: string
  message?: string
}

/**
 * adr/0051 §5: a link whose cart became an order is closed, even when its
 * paid mark (`order.placed`, run once) was lost: no second cart, so no
 * second charge; the hourly settle closes it too. The order's maker key is
 * the staff's, never in the customer's answer.
 */
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
    const complete = async (cartId: string) => {
      const { result: collection } = await createPaymentCollectionForCartWorkflow(
        getContainer()
      ).run({ input: { cart_id: cartId } })
      return completeWithSystemPayment(getContainer(), cartId, collection.id)
    }
    /** A link paid by its order, then its paid mark undone: the mark as if lost. */
    const paidThenLost = async () => {
      const made = await makeLink(http, owner.headers, linkBody(shop, product.variantId))
      const id = made.data.payment_link?.id ?? ""
      const token = tokenOf(made.data.share?.url)
      const cartId = (await open(token)).data.cart_id ?? ""
      const order = await complete(cartId)
      await eventually(
        () => linkRow(getContainer(), id),
        (row) => row.status === "paid"
      )
      await linksOf(getContainer()).updatePaymentLinks({
        id,
        status: "open",
        order_id: null,
        paid_at: null,
        closed_at: null,
      })
      return { id, token, cartId, orderId: order.order_id ?? "" }
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

    it("opens no second cart once the link's cart became an order, and closes the link for it", async () => {
      const { id, token, orderId } = await paidThenLost()

      const again = await open(token)
      const healed = await linkRow(getContainer(), id)

      expect(orderId).toMatch(/^order_/)
      expect(again.status).toBe(404)
      expect(again.data.message).toBe("payment_link.unavailable")
      expect(healed).toMatchObject({ status: "paid", order_id: orderId })
    })

    it("closes such a link on the hour, without anyone opening it", async () => {
      const { id, orderId } = await paidThenLost()

      const settled = await settlePaymentLinks(getContainer())
      const row = await linkRow(getContainer(), id)

      expect(settled).toBeGreaterThanOrEqual(1)
      expect(row).toMatchObject({ status: "paid", order_id: orderId })
    })

    it("closes the link for an order from a cart it gave up, its event lost: no reopening, no paying the later cart", async () => {
      const made = await makeLink(http, owner.headers, linkBody(shop, product.variantId))
      const id = made.data.payment_link?.id ?? ""
      const token = tokenOf(made.data.share?.url)
      const first = (await open(token)).data.cart_id ?? ""
      const second = (await open(token)).data.cart_id ?? ""
      // The race: the first cart passed its completion check before the second was bound,
      // and became an order; the paid mark for it never ran
      await linksOf(getContainer()).updatePaymentLinks({ id, cart_id: first })
      const order = await complete(first)
      await eventually(
        () => linkRow(getContainer(), id),
        (row) => row.status === "paid"
      )
      const lost = { id, status: "open" as const, order_id: null, paid_at: null, closed_at: null }
      await linksOf(getContainer()).updatePaymentLinks({ ...lost, cart_id: second })
      const start = await settle(
        http.post<Answer>(
          `/store/carts/${second}/payment-session`,
          { provider_id: BANK_TRANSFER },
          { headers: store.headers }
        )
      )
      const again = await open(token)
      const closedByOpening = await linkRow(getContainer(), id)
      await linksOf(getContainer()).updatePaymentLinks({ ...lost, cart_id: second })
      await settlePaymentLinks(getContainer())
      const closedOnTheHour = await linkRow(getContainer(), id)

      expect(order.order_id).toMatch(/^order_/)
      expect(second).not.toBe(first)
      expect(start.status).toBe(400)
      expect(start.data.message).toBe("cart.payment_link_closed")
      expect(again.status).toBe(404)
      expect(again.data.message).toBe("payment_link.unavailable")
      expect(closedByOpening).toMatchObject({ status: "paid", order_id: order.order_id })
      expect(closedOnTheHour).toMatchObject({ status: "paid", order_id: order.order_id })
    })

    it("lets no storefront make a cart a link's own, and keeps the link's maker off the order", async () => {
      const { id, cartId, orderId } = await paidThenLost()
      const forged = await settle(
        http.post<Answer>(
          "/store/carts",
          { metadata: { qt_payment_link: id } },
          { headers: store.headers }
        )
      )
      // The update path too, on a cart of the shopper's own
      const own = await settle(
        http.post<{ cart?: { id: string } }>(
          "/store/carts",
          { region_id: shop.regionId },
          { headers: store.headers }
        )
      )
      const marked = await settle(
        http.post<Answer>(
          `/store/carts/${own.data.cart?.id ?? ""}`,
          { metadata: { qt_payment_link: id } },
          { headers: store.headers }
        )
      )
      // The customer's own order, its metadata asked for
      const key = await settle(
        http.post<{ order_id?: string; token?: string }>(
          `/store/carts/${cartId}/order-access`,
          {},
          { headers: store.headers }
        )
      )
      const read = await settle(
        http.get<{ order?: { metadata?: Record<string, unknown> | null } }>(
          `/store/orders/${orderId}?fields=%2Bmetadata`,
          { headers: { ...store.headers, "x-order-token": key.data.token ?? "" } }
        )
      )
      const [stored] = await getContainer()
        .resolve(Modules.ORDER)
        .listOrders({ id: orderId }, { select: ["id", "metadata"] })

      expect(forged.status).toBe(400)
      expect(forged.data.message).toBe("cart.metadata_reserved")
      expect(own.status).toBe(200)
      expect(marked.status).toBe(400)
      expect(marked.data.message).toBe("cart.metadata_reserved")
      expect(key.status).toBe(200)
      expect(read.status).toBe(200)
      // Medusa's Store order answer keeps to its allowed fields: metadata is not among them
      // (2.21.2), so even `+metadata` brings none. Whatever it brings, no staff member's id
      expect(read.data.order?.metadata?.["qt_payment_link_by"]).toBeUndefined()
      // Nor is it on the order at all: the panel reads the maker from the link
      expect(stored?.metadata).toMatchObject({ qt_payment_link: id })
      expect(stored?.metadata).not.toHaveProperty("qt_payment_link_by")
    })
  },
})
