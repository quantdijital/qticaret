import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeAras } from "@qticaret/testing"
import type { FakeAras } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { carrierOrder, carrierShop, shipOrder } from "../helpers/carrier"
import type { CarrierShop } from "../helpers/carrier"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const MINUTE = 60 * 1000

interface Request {
  id: string
  status: string
  return_code: string | null
  return_carrier: string | null
}

interface Codes {
  aras: string | null
  yurtici: string | null
  other_carrier: string | null
  other_code: string | null
}

/**
 * The shop's contracted return code (adr/0031 Ek 2026-11-26): entered once
 * per carrier, shown on an approved return to its shopper and to staff,
 * never to another customer.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeAras
    let setup: CarrierShop
    let customer: TestCustomer
    let clock = Date.now()

    const staff = <T>(path: string, body: unknown = {}) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))
    const saveCodes = (codes: Partial<Codes>) =>
      staff<{ values: { contracted_return: Codes } }>("/admin/platform-settings/returns", {
        contracted_return: codes,
      })

    /** An Aras order of the customer's, paid, shipped and delivered. */
    const deliveredOrder = async () => {
      const orderId = await carrierOrder(getContainer(), setup, setup.variantId, 1)
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(orderId, { customer_id: customer.id })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["items.id", "payment_collections.payments.id"],
          filters: { id: orderId },
        })
      const row = data[0] as {
        items: { id: string }[]
        payment_collections: { payments: { id: string }[] }[]
      }
      const paymentId = row.payment_collections[0]?.payments[0]?.id ?? ""
      await http.post(`/admin/payments/${paymentId}/capture`, {}, { headers: setup.admin.headers })
      await shipOrder(http, setup, orderId)
      for (let step = 0; step < 4; step += 1) {
        clock += 30 * MINUTE
        await pollShipments(getContainer(), new Date(clock))
      }
      return { orderId, lineId: row.items[0]?.id ?? "" }
    }

    beforeAll(async () => {
      fake = await startFakeAras()
      process.env["ARAS_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["ARAS_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      setup = await carrierShop(http, getContainer(), fake)
      customer = await registerCustomer(http, await createStorefront(getContainer()))
    })

    it("saves each carrier's code alone and refuses a malformed one or a name without its code", async () => {
      const aras = await saveCodes({ aras: " AR-48213 " })
      const yurtici = await saveCodes({ yurtici: "998877" })
      const malformed = await saveCodes({ aras: "<b>1</b>" })
      const tooLong = await saveCodes({ yurtici: "1".repeat(41) })
      const nameOnly = await saveCodes({ other_carrier: "MNG Kargo" })
      const both = await saveCodes({ other_carrier: "MNG Kargo", other_code: "555" })
      const cleared = await saveCodes({ aras: null })

      expect(aras.status).toBe(200)
      expect(aras.data.values.contracted_return.aras).toBe("AR-48213")
      // The other carrier's code stays as it was
      expect(yurtici.data.values.contracted_return).toMatchObject({
        aras: "AR-48213",
        yurtici: "998877",
      })
      expect([malformed.status, malformed.data.message]).toEqual([
        400,
        "platform_settings.return_code_invalid",
      ])
      expect(tooLong.status).toBe(400)
      expect([nameOnly.status, nameOnly.data.message]).toEqual([
        400,
        "platform_settings.return_carrier_both",
      ])
      expect(both.data.values.contracted_return).toMatchObject({
        other_carrier: "MNG Kargo",
        other_code: "555",
      })
      expect(cleared.data.values.contracted_return).toMatchObject({
        aras: null,
        yurtici: "998877",
      })
    })

    it("shows the code on an approved return to its shopper and staff, not to anyone else", async () => {
      const { orderId, lineId } = await deliveredOrder()
      await saveCodes({ aras: null, yurtici: null, other_carrier: null, other_code: null })
      const before = await settle(
        http.get<{ contracted_return: unknown }>("/admin/return-requests", {
          headers: setup.admin.headers,
        })
      )
      await saveCodes({ aras: "AR-48213" })
      const { data: asked } = await http.post<{ return_request: Request }>(
        `/store/orders/${orderId}/returns`,
        { items: [{ line_item_id: lineId, quantity: 1 }], reason: "changed_mind" },
        { headers: customer.headers }
      )
      const approved = await staff<{ return_request: Request }>(
        `/admin/return-requests/${asked.return_request.id}/approve`
      )
      const listed = await settle(
        http.get<{ return_requests: Request[]; contracted_return: unknown }>(
          `/admin/return-requests?order_id=${orderId}`,
          { headers: setup.admin.headers }
        )
      )
      const mine = await settle(
        http.get<{ return_requests: Request[] }>(`/store/orders/${orderId}/returns`, {
          headers: customer.headers,
        })
      )
      const someoneElse = await registerCustomer(http, await createStorefront(getContainer()))
      const theirs = await settle(
        http.get<{ return_requests?: Request[] }>(`/store/orders/${orderId}/returns`, {
          headers: someoneElse.headers,
        })
      )

      const shown = { return_code: "AR-48213", return_carrier: "Aras Kargo" }
      expect(before.data.contracted_return).toBeNull()
      // Asked, not yet approved: nothing to hand over
      expect(asked.return_request).toMatchObject({ return_code: null, return_carrier: null })
      expect(approved.data.return_request).toMatchObject({ status: "approved", ...shown })
      expect(listed.data.contracted_return).toEqual({ carrier: "Aras Kargo", code: "AR-48213" })
      expect(listed.data.return_requests[0]).toMatchObject(shown)
      expect(mine.data.return_requests[0]).toMatchObject(shown)
      expect(theirs.status).toBe(404)
      expect(JSON.stringify(theirs.data)).not.toContain("AR-48213")

      // Taken back by staff: the code no longer goes with it
      await staff(`/admin/return-requests/${asked.return_request.id}/cancel`, {
        reason: "Müşteri vazgeçti",
      })
      const { data: after } = await http.get<{ return_requests: Request[] }>(
        `/store/orders/${orderId}/returns`,
        { headers: customer.headers }
      )
      expect(after.return_requests[0]).toMatchObject({
        status: "canceled",
        return_code: null,
        return_carrier: null,
      })
    })
  },
})
