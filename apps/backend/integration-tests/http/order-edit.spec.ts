import { randomUUID } from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { EINVOICE_MODULE } from "../../src/modules/einvoice"
import type EinvoiceModuleService from "../../src/modules/einvoice/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { readOrderMoney } from "../../src/workflows/orders/order-money"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface EditAnswer {
  difference?: string
  refund_error?: string | null
  message?: string
}

/** F7.12 (adr/0033): staff change an order's lines and address before it is packed. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let admin: { headers: Record<string, string> }
    let knife: string
    let board: string

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const key = () => randomUUID().replace(/-/g, "")
    const post = <T>(path: string, body: unknown = {}) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: admin.headers }))
    /** A knife (120 TL) and a board (80 TL), shipping 90 TL, paid and taken by card. */
    const paidOrder = async (capture = true) => {
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [
          { variant_id: knife, quantity: 1 },
          { variant_id: board, quantity: 1 },
        ],
        address: PAYTR_ADDRESS,
      })
      const { data } = await query().graph({
        entity: "order",
        fields: ["items.id", "items.variant_id", "payment_collections.payments.id"],
        filters: { id: orderId },
      })
      const row = data[0] as {
        items: { id: string; variant_id: string }[]
        payment_collections: { payments: { id: string }[] }[]
      }
      if (capture) {
        await post(`/admin/payments/${row.payment_collections[0]?.payments[0]?.id ?? ""}/capture`)
      }
      const lineOf = (variantId: string) =>
        row.items.find((item) => item.variant_id === variantId)?.id ?? ""
      return { orderId, knifeLine: lineOf(knife), boardLine: lineOf(board) }
    }
    const orderOf = async (orderId: string) => {
      const { data } = await query().graph({
        entity: "order",
        fields: [
          "summary",
          "items.variant_id",
          "items.quantity",
          "items.unit_price",
          "items.detail.quantity",
          "items.detail.unit_price",
        ],
        filters: { id: orderId },
      })
      const row = data[0] as {
        summary: { paid_total: unknown; pending_difference: unknown }
        items: { variant_id: string; quantity: unknown; unit_price: unknown }[]
      }
      return {
        paid: Number(row.summary.paid_total),
        pending: Number(row.summary.pending_difference),
        lines: Object.fromEntries(
          row.items.map((item) => [
            item.variant_id,
            { quantity: Number(item.quantity), price: Number(item.unit_price) },
          ])
        ),
      }
    }
    const reservedOf = async (variantId: string) => {
      const { data } = await query().graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory.reserved_quantity"],
        filters: { id: variantId },
      })
      return (data[0] as { inventory_items: { inventory: { reserved_quantity: number } }[] })
        .inventory_items[0]?.inventory.reserved_quantity
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
      const stamp = `${String(Date.now())}-${String(Math.random()).slice(2, 6)}`
      knife = (await stockedProduct(container, shop, `bicak-${stamp}`, 10, 120)).variantId
      board = (await stockedProduct(container, shop, `tahta-${stamp}`, 10, 80)).variantId
    })

    it("adds a knife and takes the board off once the 40 TL difference is collected", async () => {
      const { orderId, knifeLine, boardLine } = await paidOrder()
      const change = {
        items: [
          { id: knifeLine, quantity: 2 },
          { id: boardLine, quantity: 0 },
        ],
      }
      const before = await orderOf(orderId)

      const preview = await post<EditAnswer>(`/admin/orders/${orderId}/edit/preview`, change)
      const untouched = await orderOf(orderId)
      const unpaid = await post<EditAnswer>(`/admin/orders/${orderId}/edit`, {
        ...change,
        expected_difference: 40,
        reference: key(),
      })
      const once = key()
      const edited = await post<EditAnswer>(`/admin/orders/${orderId}/edit`, {
        ...change,
        expected_difference: 40,
        difference_collected: true,
        reference: once,
      })
      // A retry of the same save is made once
      const again = await post<EditAnswer>(`/admin/orders/${orderId}/edit`, {
        ...change,
        expected_difference: 40,
        difference_collected: true,
        reference: once,
      })
      const after = await orderOf(orderId)

      expect(preview.data.difference).toBe("40.00")
      // The preview keeps nothing
      expect(untouched.lines).toEqual(before.lines)
      expect(unpaid.data.message).toBe("orders.edit_difference_due")
      expect(edited.data).toMatchObject({ difference: "40.00", refund_error: null })
      expect(again.data).toMatchObject({ difference: null, refund_error: null })
      expect(after.lines[knife]?.quantity).toBe(2)
      expect(after.lines[board]?.quantity ?? 0).toBe(0)
      // The 40 TL is paid on the order, and its stock follows the lines
      expect(after.paid).toBe(before.paid + 40)
      expect(after.pending).toBe(0)
      expect(await reservedOf(knife)).toBe(2)
      expect(await reservedOf(board)).toBe(0)
    })

    it("corrects a price down and gives the 20 TL back at once", async () => {
      const { orderId, knifeLine } = await paidOrder()
      const change = { items: [{ id: knifeLine, quantity: 1, unit_price: 100 }] }

      const preview = await post<EditAnswer>(`/admin/orders/${orderId}/edit/preview`, change)
      const edited = await post<EditAnswer>(`/admin/orders/${orderId}/edit`, {
        ...change,
        expected_difference: -20,
        reference: key(),
      })
      const money = await readOrderMoney(getContainer(), orderId)
      const later = await post<EditAnswer>(`/admin/orders/${orderId}/edit/preview`, {
        items: [{ id: knifeLine, quantity: 2 }],
      })
      const { data: details } = await http.get<{ refunds: { amount: string; status: string }[] }>(
        `/admin/orders/${orderId}/payment-details`,
        { headers: admin.headers }
      )

      expect(preview.data.difference).toBe("-20.00")
      expect(edited.data).toMatchObject({ difference: "-20.00", refund_error: null })
      expect((await orderOf(orderId)).lines[knife]?.price).toBe(100)
      // Our money reads the corrected price: the knife line is 100 TL, the order 270 TL
      // (the board 80, shipping 90)
      expect(money.lines.find((line) => line.id === knifeLine)?.gross).toBe(10_000)
      expect(money.net).toBe(27_000)
      // The 20 TL went back against no line: nothing left owed either way
      expect(later.data.difference).toBe("100.00")
      expect(details.refunds).toEqual([
        expect.objectContaining({ amount: "20.00", status: "done" }),
      ])
    })

    it("refuses an order whose money moved outside its lines (a refund before)", async () => {
      const { orderId, knifeLine } = await paidOrder()
      await post(`/admin/orders/${orderId}/refunds`, {
        amount: 30,
        reference: key(),
      })

      const refused = await post<EditAnswer>(`/admin/orders/${orderId}/edit/preview`, {
        items: [{ id: knifeLine, quantity: 2 }],
      })

      expect(refused.data.message).toBe("orders.edit_balance_open")
    })

    it("refuses a moved difference, an unpaid order, a packed one, and Medusa's own edits", async () => {
      const { orderId, knifeLine } = await paidOrder()
      const unpaid = await paidOrder(false)
      const add = { add: [{ variant_id: board, quantity: 1 }] }

      const moved = await post<EditAnswer>(`/admin/orders/${orderId}/edit`, {
        ...add,
        expected_difference: 10,
        difference_collected: true,
        reference: key(),
      })
      const notTaken = await post<EditAnswer>(`/admin/orders/${unpaid.orderId}/edit/preview`, add)
      const core = await post(`/admin/order-edits`, { order_id: orderId })
      const moved_to = await post(`/admin/orders/${orderId}`, {
        shipping_address: { address_1: "Yeni Sokak No 5" },
      })
      const wrongPlace = await post(`/admin/orders/${orderId}`, {
        shipping_address: { province: "İstanbul", city: "Çankaya" },
      })
      await post(`/admin/orders/${orderId}/ship`, { notify: false })
      const packed = await post<EditAnswer>(`/admin/orders/${orderId}/edit/preview`, {
        items: [{ id: knifeLine, quantity: 2 }],
      })
      const lateAddress = await post(`/admin/orders/${orderId}`, {
        shipping_address: { address_1: "Başka Sokak No 7" },
      })

      expect(moved.data.message).toBe("orders.edit_difference_changed")
      // Still the knife and one board: nothing added
      expect((await orderOf(orderId)).lines[board]?.quantity).toBe(1)
      expect(notTaken.data.message).toBe("orders.edit_payment_unsupported")
      expect(core.data.message).toBe("orders.use_order_edit")
      expect(moved_to.status).toBe(200)
      expect(wrongPlace.status).toBe(400)
      expect(packed.data.message).toBe("orders.edit_after_packing")
      expect(lateAddress.data.message).toBe("orders.edit_after_packing")
    })

    it("keeps the billing address once the sale invoice is issuing or issued", async () => {
      const { orderId } = await paidOrder(false)
      const invoices = getContainer().resolve<EinvoiceModuleService>(EINVOICE_MODULE)
      const invoice = await invoices.createInvoices({
        order_id: orderId,
        kind: "sale",
        source_id: orderId,
        provider: "external",
        status: "pending",
        next_attempt_at: new Date(),
        net_total: 100,
        vat_total: 20,
        gross_total: 120,
      })
      const billing = (address_1: string) =>
        post(`/admin/orders/${orderId}`, { billing_address: { address_1 } })
      // The panel's order page reads the same rule from the order's state
      const locked = async () =>
        (
          await settle(
            http.get<{ billing_locked?: boolean }>(`/admin/order-board/${orderId}`, {
              headers: admin.headers,
            })
          )
        ).data.billing_locked

      const lockedWhilePending = await locked()
      const whilePending = await billing("Fatura Sokak No 1")
      // BirFatura pulled it: the row still waits, the provider holds the old buyer
      await invoices.updateInvoices({ id: invoice.id, listed_at: new Date() })
      const lockedWhileListed = await locked()
      const whileListed = await billing("Fatura Sokak No 1b")
      await invoices.updateInvoices({ id: invoice.id, status: "issuing" })
      const whileIssuing = await billing("Fatura Sokak No 2")
      const shippingStill = await post(`/admin/orders/${orderId}`, {
        shipping_address: { address_1: "Teslimat Sokak No 3" },
      })
      await invoices.updateInvoices({ id: invoice.id, status: "issued" })
      const onceIssued = await billing("Fatura Sokak No 4")
      const { data } = await query().graph({
        entity: "order",
        fields: ["billing_address.address_1"],
        filters: { id: orderId },
      })

      expect([lockedWhilePending, lockedWhileListed]).toEqual([false, true])
      expect(whilePending.status).toBe(200)
      expect(whileListed.data.message).toBe("orders.billing_invoiced")
      expect(whileIssuing.status).toBe(400)
      expect(whileIssuing.data.message).toBe("orders.billing_invoiced")
      expect(shippingStill.status).toBe(200)
      expect(onceIssued.data.message).toBe("orders.billing_invoiced")
      expect(
        (data[0] as { billing_address: { address_1: string } }).billing_address.address_1
      ).toBe("Fatura Sokak No 1")
    })
  },
})
