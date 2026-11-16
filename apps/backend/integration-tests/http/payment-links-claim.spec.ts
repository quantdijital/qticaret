import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  completeCartWorkflow,
  createPaymentCollectionForCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CLAIM_TTL_MS } from "../../src/modules/payment-links/service"
import { completedLinkCarts } from "../../src/workflows/payment-links/link-carts"
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

interface PaymentsRow {
  payment_collection?: { payments?: ({ id: string } | null)[] | null } | null
}

/**
 * adr/0051 §5: of two carts of one link completing at once, one holds the
 * link (`claimForCart`, one conditional update) and becomes the order; the
 * other is refused before its order and its payment's authorization.
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
    const newLink = async () => {
      const made = await makeLink(http, owner.headers, linkBody(shop, product.variantId))
      return { id: made.data.payment_link?.id ?? "", token: tokenOf(made.data.share?.url) }
    }
    /** The payments a cart's collection took: none for a cart refused before authorization. */
    const paymentsOf = async (cartId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "cart",
          fields: ["id", "payment_collection.payments.id"],
          filters: { id: cartId },
        })
      return ((data[0] as PaymentsRow | undefined)?.payment_collection?.payments ?? []).filter(
        Boolean
      )
    }
    const ordersOf = async (linkId: string) =>
      (await completedLinkCarts(getContainer(), { link_id: linkId })).filter(
        (cart) => cart.order_id
      )

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

    it("refuses a cart of the link while another cart's completion holds it, before any payment", async () => {
      const { id, token } = await newLink()
      const first = (await open(token)).data.cart_id ?? ""
      // The first cart's completion is under way: it holds the link
      const held = await linksOf(getContainer()).claimForCart(id, first)
      const second = (await open(token)).data.cart_id ?? ""

      const refused = await complete(second)
      const row = await linkRow(getContainer(), id)

      expect(held).toBe(true)
      expect(second).not.toBe(first)
      expect(refused).toEqual({ order_id: null, message: "cart.payment_link_closed" })
      expect(await paymentsOf(second)).toHaveLength(0)
      expect(await ordersOf(id)).toHaveLength(0)
      expect(row).toMatchObject({ status: "open", cart_id: second, claimed_cart_id: first })
    })

    it("makes exactly one order when a cart completes while the link opens another", async () => {
      const { id, token } = await newLink()
      const first = (await open(token)).data.cart_id ?? ""

      // Whatever wins the race, the link becomes one order and the loser takes no payment
      const [firstDone, secondDone] = await Promise.all([
        complete(first),
        (async () => {
          const second = (await open(token)).data.cart_id
          return second ? { cartId: second, ...(await complete(second)) } : null
        })(),
      ])
      const orders = [firstDone.order_id, secondDone?.order_id].filter(Boolean)
      const loser = firstDone.order_id ? secondDone?.cartId : first
      const paid = await eventually(
        () => linkRow(getContainer(), id),
        (row) => row.status === "paid"
      )

      expect(orders).toHaveLength(1)
      expect(await ordersOf(id)).toHaveLength(1)
      expect(paid.order_id).toBe(orders[0])
      if (loser) {
        expect(await paymentsOf(loser)).toHaveLength(0)
      }
    })

    it("makes one order of one cart completed twice at once (two notices)", async () => {
      const { id, token } = await newLink()
      const cartId = (await open(token)).data.cart_id ?? ""
      const first = await complete(cartId)

      const again = await Promise.all([
        completeCartWorkflow(getContainer()).run({ input: { id: cartId }, throwOnError: false }),
        completeCartWorkflow(getContainer()).run({ input: { id: cartId }, throwOnError: false }),
      ])
      const ids = new Set(again.flatMap(({ result }) => (result?.id ? [result.id] : [])))

      expect(first.order_id).toMatch(/^order_/)
      expect([...ids].every((orderId) => orderId === first.order_id)).toBe(true)
      expect(await ordersOf(id)).toHaveLength(1)
      expect(await paymentsOf(cartId)).toHaveLength(1)
    })

    it("frees a hold its completion left behind once it is stale", async () => {
      const { id, token } = await newLink()
      const abandoned = (await open(token)).data.cart_id ?? ""
      await linksOf(getContainer()).claimForCart(
        id,
        abandoned,
        new Date(Date.now() - CLAIM_TTL_MS - 60_000)
      )
      const latest = (await open(token)).data.cart_id ?? ""

      const order = await complete(latest)
      const paid = await eventually(
        () => linkRow(getContainer(), id),
        (row) => row.status === "paid"
      )

      expect(order.order_id).toMatch(/^order_/)
      expect(paid).toMatchObject({ order_id: order.order_id, claimed_cart_id: latest })
    })
  },
})
