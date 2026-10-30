import type { ICartModuleService, ICustomerModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createOrderFulfillmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { customerData } from "../../src/workflows/legal/customer-data"
import { createAdminUser } from "../helpers/admin"
import { INDIVIDUAL, TCKN, saveProfile } from "../helpers/billing-profile"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface OrderRow {
  email: string
  // A BigNumber from the graph, a number from the Store API
  total: unknown
  shipping_address: Record<string, string | null>
}

/** F13.5 (adr/0041 §6; KK3): a customer's copy of their data, then their erasure; the books stay. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("hands over a customer's data, then erases them while the order keeps its amounts", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const storefront = await createStorefront(container)
      const admin = await createAdminUser(http, container)
      const { variantId } = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10)
      const post = <T>(url: string, body: unknown = {}, headers = admin.headers) =>
        settle(http.post<T & { message?: string }>(url, body, { headers }))
      await post("/admin/platform-settings/cash_on_delivery", {
        fee_type: "none",
        fee_value: 0,
        max_amount: 100_000,
        shipping_option_ids: [shop.shippingOptionId],
      })
      await post("/admin/features/payments.cash_on_delivery", { enabled: true })

      // A customer with an account, an invoice identity, an address and an order
      const customer = await registerCustomer(
        http,
        storefront,
        `ayse-${String(Date.now())}@example.com`
      )
      await saveProfile(http, customer, INDIVIDUAL)
      const customers = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
      await customers.createCustomerAddresses({
        customer_id: customer.id,
        first_name: "Ayşe",
        last_name: "Yılmaz",
        address_1: "Bağdat Cad. No: 7",
        city: "Kadıköy",
        province: "İstanbul",
        country_code: "tr",
        phone: "05321112233",
      })
      const cartId = await readyCart(container, shop, variantId)
      await container
        .resolve<ICartModuleService>(Modules.CART)
        .updateCarts(cartId, { customer_id: customer.id, email: customer.email })
      await post(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: "pp_cod_cod" },
        storefront.headers
      )
      const completed = await post<{ order: { id: string; total: unknown } }>(
        `/store/carts/${cartId}/complete`,
        {},
        storefront.headers
      )
      const orderId = completed.data.order.id
      // Medusa's own edit keeps the old e-mail in the order's history
      const edited = await post(`/admin/orders/${orderId}`, { email: "ayse.yeni@example.com" })
      await post(`/admin/orders/${orderId}/notes`, { body: "Ayşe Hanım telefonla aradı" })

      // The copy of their data
      const now = new Date().toISOString()
      const exportRequest = await post<{ privacy_request: { id: string; due_at: string } }>(
        `/admin/customers/${customer.id}/privacy-requests`,
        { kind: "export", channel: "email", received_at: now }
      )
      const exportId = exportRequest.data.privacy_request.id
      const job = await post<{ job: { id: string } }>(`/admin/privacy-requests/${exportId}/export`)
      const data = await customerData(container, customer.id)
      const closed = await post(`/admin/privacy-requests/${exportId}/close`, {
        status: "completed",
      })
      const closedAgain = await post(`/admin/privacy-requests/${exportId}/close`, {
        status: "completed",
      })

      // The erasure, proved again
      const erasure = await post<{ privacy_request: { id: string } }>(
        `/admin/customers/${customer.id}/privacy-requests`,
        { kind: "erasure", channel: "letter", received_at: now }
      )
      const erasureId = erasure.data.privacy_request.id
      const unproved = await post(`/admin/privacy-requests/${erasureId}/erase`, {}, admin.plain)
      // An order on its way still needs its address
      const underWay = await post(`/admin/privacy-requests/${erasureId}/erase`)
      const closedWithout = await post(`/admin/privacy-requests/${erasureId}/close`, {
        status: "completed",
      })
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: lines } = await query.graph({
        entity: "order",
        fields: ["items.id"],
        filters: { id: orderId },
      })
      const items = (lines[0] as unknown as { items: { id: string }[] }).items
      const { result: parcel } = await createOrderFulfillmentWorkflow(container).run({
        input: {
          order_id: orderId,
          // One of each, as the cart was
          items: items.map((item) => ({ id: item.id, quantity: 1 })),
        },
      })
      // As "Kargoya ver" leaves it: the carrier's label stored as a private file
      const [label] = await container.resolve(Modules.FILE).createFiles([
        {
          filename: "etiket.pdf",
          mimeType: "application/pdf",
          content: Buffer.from("Ayşe Yılmaz, Bağdat Cad. No: 7").toString("base64"),
          access: "private",
        },
      ])
      await container
        .resolve(Modules.FULFILLMENT)
        .updateFulfillment(parcel.id, { data: { label_file_id: label?.id } })
      await markOrderFulfillmentAsDeliveredWorkflow(container).run({
        input: { orderId, fulfillmentId: parcel.id },
      })
      const erased = await post(`/admin/privacy-requests/${erasureId}/erase`)
      const again = await post(`/admin/privacy-requests/${erasureId}/erase`)
      const labelLeft = await container
        .resolve(Modules.FILE)
        .retrieveFile(label?.id ?? "")
        .then(() => true)
        .catch(() => false)

      const [gone] = await customers.listCustomers({ id: customer.id }, { withDeleted: true })
      const addresses = await customers.listCustomerAddresses(
        { customer_id: customer.id },
        { withDeleted: true }
      )
      const { data: orders } = await query.graph({
        entity: "order",
        fields: ["email", "total", "shipping_address.*"],
        filters: { id: orderId },
      })
      const order = orders[0] as unknown as OrderRow
      const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const stored = JSON.stringify([
        await db.select("*").from("order_change_action"),
        await db.select("*").from("order_address"),
        await db.select("*").from("customer_address"),
        await db.select("*").from("billing_profile"),
        await db.select("*").from("order_note"),
        await db.select("*").from("fulfillment_address"),
        await db.select("*").from("fulfillment"),
        await db.select("*").from("provider_identity"),
        await db.select("*").from("auth_identity"),
      ])
      const login = await settle(
        http.post("/auth/customer/emailpass", {
          email: customer.email,
          password: customer.password,
        })
      )

      expect(edited.status).toBe(200)
      expect(exportRequest.status).toBe(200)
      expect(job.data.job.id).toEqual(expect.any(String))
      expect(data.siparişler).toHaveLength(1)
      expect(data.müşteri).toMatchObject({ email: customer.email })
      expect(data.fatura_bilgisi).toMatchObject({ legal_name: "Ayşe Yılmaz", tax_id_last4: "0146" })
      expect(closed.status).toBe(200)
      expect(closedAgain.status).toBe(409)
      expect(unproved.status).toBe(428)
      expect(underWay.status).toBe(409)
      expect(underWay.data.message).toBe("privacy_requests.orders_open")
      expect(closedWithout.data.message).toBe("privacy_requests.erase_to_complete")
      expect(erased.status).toBe(200)
      expect(labelLeft).toBe(false)
      expect(again.status).toBe(409)
      expect(gone).toMatchObject({ first_name: null, last_name: null, phone: null })
      expect(gone?.email).toMatch(/@kvkk\.invalid$/)
      expect(gone?.deleted_at).not.toBeNull()
      expect(addresses).toEqual([])
      // The books: the amount stays, the place stays, the person goes
      expect(Number(order.total)).toBe(Number(completed.data.order.total))
      expect(order.email).toMatch(/@kvkk\.invalid$/)
      expect(order.shipping_address).toMatchObject({
        first_name: "Anonim",
        last_name: null,
        address_1: null,
        phone: null,
        city: "Kadıköy",
      })
      for (const personal of [
        customer.email,
        "ayse.yeni@example.com",
        "Bağdat",
        "Atatürk",
        TCKN,
        "Hanım",
      ]) {
        expect(stored).not.toContain(personal)
      }
      expect(login.status).toBe(401)
    })
  },
})
