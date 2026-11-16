import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  completeCartWorkflow,
  createPaymentCollectionForCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CLAIM_TTL_MS } from "../../src/lib/payment-links/snapshot"
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

    it("opens no second cart while the first cart's completion holds the link", async () => {
      const { id, token } = await newLink()
      const first = (await open(token)).data.cart_id ?? ""
      // The first cart's completion is under way: it holds the link
      const held = await linksOf(getContainer()).claimForCart(id, first, "run_first")
      const second = await open(token)
      const row = await linkRow(getContainer(), id)

      expect(held).toBe("held")
      expect(second.status).toBe(409)
      expect(second.data.message).toBe("payment_link.unavailable")
      expect(row).toMatchObject({ status: "open", cart_id: first, claimed_cart_id: first })
    })

    it("tries a cart again, its payment untouched, while another cart's completion holds the link", async () => {
      const { id, token } = await newLink()
      const first = (await open(token)).data.cart_id ?? ""
      const second = (await open(token)).data.cart_id ?? ""
      // The first cart passed its checks before the second was bound, and holds the link now
      await linksOf(getContainer()).updatePaymentLinks({
        id,
        claimed_cart_id: first,
        claimed_at: new Date(),
        claim_token: "run_first",
      })

      const waiting = await complete(second)
      const paymentsWhileHeld = await paymentsOf(second)
      // The first cart's completion failed: its compensation lets go, and the second goes on
      await linksOf(getContainer()).releaseClaim(id, "run_first")
      const { result, errors } = await completeCartWorkflow(getContainer()).run({
        input: { id: second },
        throwOnError: false,
      })
      const paid = await eventually(
        () => linkRow(getContainer(), id),
        (row) => row.status === "paid"
      )

      expect(waiting).toEqual({ order_id: null, message: "errors.temporarily_unavailable" })
      expect(paymentsWhileHeld).toHaveLength(0)
      expect(errors).toEqual([])
      expect(paid).toMatchObject({ order_id: result.id, claimed_cart_id: second })
      expect(await ordersOf(id)).toHaveLength(1)
    })

    it("keeps staff from canceling a link while a cart's completion holds it", async () => {
      const { id, token } = await newLink()
      const cartId = (await open(token)).data.cart_id ?? ""
      await linksOf(getContainer()).claimForCart(id, cartId, "run_one")

      const refused = await settle(
        http.post<Answer>(`/admin/payment-links/${id}/cancel`, {}, { headers: owner.headers })
      )
      await linksOf(getContainer()).releaseClaim(id, "run_one")
      const canceled = await settle(
        http.post<Answer>(`/admin/payment-links/${id}/cancel`, {}, { headers: owner.headers })
      )

      expect(refused.status).toBe(409)
      expect(refused.data.message).toBe("payment_link.paying")
      expect(canceled.status).toBe(200)
      expect((await linkRow(getContainer(), id)).status).toBe("canceled")
    })

    it("lets a run let go only of its own hold", async () => {
      const { id, token } = await newLink()
      const cartId = (await open(token)).data.cart_id ?? ""
      await linksOf(getContainer()).claimForCart(id, cartId, "run_one")
      // The same cart's notice again: it holds the link under its own run
      await linksOf(getContainer()).claimForCart(id, cartId, "run_two")

      await linksOf(getContainer()).releaseClaim(id, "run_one")
      const kept = await linkRow(getContainer(), id)
      await linksOf(getContainer()).releaseClaim(id, "run_two")
      const freed = await linkRow(getContainer(), id)

      expect(kept).toMatchObject({ claimed_cart_id: cartId, claim_token: "run_two" })
      expect(freed).toMatchObject({ claimed_cart_id: null, claimed_at: null, claim_token: null })
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

    it("makes one order of one cart completed again twice at once (two late notices)", async () => {
      const { id, token } = await newLink()
      const cartId = (await open(token)).data.cart_id ?? ""
      const first = await complete(cartId)
      // The notices come after the link is paid
      await eventually(
        () => linkRow(getContainer(), id),
        (row) => row.status === "paid"
      )

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
      // A completion that died halfway, long ago: its hold was never let go
      await linksOf(getContainer()).updatePaymentLinks({
        id,
        claimed_cart_id: abandoned,
        claimed_at: new Date(Date.now() - CLAIM_TTL_MS - 60_000),
        claim_token: "run_dead",
      })
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
