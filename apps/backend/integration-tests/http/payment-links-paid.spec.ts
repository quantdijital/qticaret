import { createPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { settlePaymentLinks } from "../../src/workflows/payment-links/settle"
import { createAdminUser } from "../helpers/admin"
import { completeWithSystemPayment } from "../helpers/checkout"
import { eventually } from "../helpers/eventually"
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

    it("lets no storefront make a cart a link's own, and shows no staff id on the customer's order", async () => {
      const { id, cartId, orderId } = await paidThenLost()
      const forged = await settle(
        http.post<Answer>(
          "/store/carts",
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

      expect(forged.status).toBe(400)
      expect(forged.data.message).toBe("cart.metadata_reserved")
      expect(key.status).toBe(200)
      expect(read.status).toBe(200)
      // The order keeps its link and number for the customer; the maker is the staff's
      expect(read.data.order?.metadata).toMatchObject({ qt_payment_link: id })
      expect(read.data.order?.metadata).not.toHaveProperty("qt_payment_link_by")
    })
  },
})
