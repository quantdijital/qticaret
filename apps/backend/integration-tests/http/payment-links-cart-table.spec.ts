import { Modules } from "@medusajs/framework/utils"
import { createPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fillPaymentLinkCarts } from "../../src/migration-scripts/payment-link-carts"
import { completedLinkCarts } from "../../src/workflows/payment-links/link-carts"
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
 * adr/0051 §3: a link's carts are kept in `payment_link_cart` when the
 * link opens them, and looked up there (the completion guard, a link's
 * reopening, the hourly settle), never by the carts' JSON metadata.
 * Carts opened before the table are filled in from their mark by the
 * migration script, as often as it runs.
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
    const rowsOf = (filters: { link_id?: string; cart_id?: string }) =>
      linksOf(getContainer()).listPaymentLinkCarts(filters, { take: null })
    /** A link paid by its cart's order, then its paid mark undone: the mark as if lost. */
    const paidThenLost = async () => {
      const { id, token } = await newLink()
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
    /** The link's rows gone: its carts as one opened before the table, marked only. */
    const forgetRows = async (linkId: string) => {
      const rows = await rowsOf({ link_id: linkId })
      await linksOf(getContainer()).deletePaymentLinkCarts(rows.map((row) => row.id))
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

    it("keeps every cart a link opens, and finds the link's order through them", async () => {
      const { id, token } = await newLink()
      const first = (await open(token)).data.cart_id ?? ""
      const second = (await open(token)).data.cart_id ?? ""
      const kept = await rowsOf({ link_id: id })
      const order = await complete(second)
      const placed = await completedLinkCarts(getContainer(), { link_id: id })

      expect(second).not.toBe(first)
      expect(kept.map((row) => row.cart_id).sort()).toEqual([first, second].sort())
      expect(kept.every((row) => row.link_id === id)).toBe(true)
      // The cart keeps its mark too: the checkout and the storefront read it
      const [cart] = await getContainer()
        .resolve(Modules.CART)
        .listCarts({ id: second }, { select: ["id", "metadata"] })
      expect(cart?.metadata).toMatchObject({ qt_payment_link: id })
      expect(placed).toEqual([{ cart_id: second, link_id: id, order_id: order.order_id }])
    })

    it("still sees a link's latest cart that has no row: settled on the hour, no second cart", async () => {
      const first = await paidThenLost()
      const second = await paidThenLost()
      // Both carts as if opened by the code before the table: the link names them alone
      await forgetRows(first.id)
      await forgetRows(second.id)

      // The second by its reopening (the link's own read), the first on the hour
      const again = await open(second.token)
      const settled = await settlePaymentLinks(getContainer())
      const rows = await Promise.all([
        linkRow(getContainer(), first.id),
        linkRow(getContainer(), second.id),
      ])

      expect(settled).toBeGreaterThanOrEqual(1)
      expect(rows[0]).toMatchObject({ status: "paid", order_id: first.orderId })
      expect(again.status).toBe(404)
      expect(again.data.message).toBe("payment_link.unavailable")
      expect(rows[1]).toMatchObject({ status: "paid", order_id: second.orderId })
    })

    it("sees a given-up cart that became an order once it is filled in: no second cart", async () => {
      const { id, token } = await newLink()
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
      // Opened before the table: only the mark on the carts names the link
      await forgetRows(id)

      await settlePaymentLinks(getContainer())
      const unseen = await linkRow(getContainer(), id)
      const filled = await fillPaymentLinkCarts(getContainer())
      const kept = await rowsOf({ link_id: id })
      const again = await open(token)
      const row = await linkRow(getContainer(), id)

      expect(unseen).toMatchObject({ status: "open", order_id: null })
      expect(filled.added).toBeGreaterThanOrEqual(2)
      expect(kept.map((entry) => entry.cart_id).sort()).toEqual([first, second].sort())
      expect(again.status).toBe(404)
      expect(again.data.message).toBe("payment_link.unavailable")
      expect(row).toMatchObject({ status: "paid", order_id: order.order_id })
    })

    it("fills in a cart that has only the link's mark, once however often it runs", async () => {
      const { id } = await newLink()
      const carts = getContainer().resolve(Modules.CART)
      const [marked, blank] = await carts.createCarts([
        { region_id: shop.regionId, currency_code: "try", metadata: { qt_payment_link: id } },
        { region_id: shop.regionId, currency_code: "try", metadata: { qt_payment_link: "" } },
      ])

      const first = await fillPaymentLinkCarts(getContainer())
      const again = await fillPaymentLinkCarts(getContainer())
      const kept = await rowsOf({ cart_id: marked?.id ?? "" })
      const none = await rowsOf({ cart_id: blank?.id ?? "" })

      expect(first.added).toBeGreaterThanOrEqual(1)
      expect(again.added).toBe(0)
      expect(again.read).toBe(first.read)
      expect(kept).toHaveLength(1)
      expect(kept[0]).toMatchObject({ link_id: id, cart_id: marked?.id })
      expect(none).toHaveLength(0)
    })
  },
})
