import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGeliver, startFakeMail } from "@qticaret/testing"
import type { FakeGeliver, FakeMail } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { RETURN_REQUESTS_MODULE } from "../../src/modules/return-requests"
import type ReturnRequestsModuleService from "../../src/modules/return-requests/service"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import { geliverOrder, geliverShop, shipOrder } from "../helpers/geliver"
import type { GeliverShop } from "../helpers/geliver"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const MINUTE = 60 * 1000
const SHOPPER = "ayse.iptal@example.com"

interface Request {
  id: string
  status: string
  decision_note: string | null
  return_code: string | null
  canceled_by: string | null
  cancel_cause: string | null
  cancel_reason: string | null
  items: { line_item_id: string; gift_card: boolean }[]
}

interface Returnable {
  open_request: boolean
  lines: { line_item_id: string; returnable: number; window_open: boolean }[]
}

/**
 * Order #691: staff take an approval back while nothing has come back
 * (the shopper gave up, or it was a mistake). The carrier's return is
 * withdrawn, Medusa's return cancelled, the lines open to be asked again,
 * the shopper told; the reason stays with the team.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let geliver: FakeGeliver
    let mail: FakeMail
    let setup: GeliverShop
    let customer: TestCustomer
    let clock = Date.now()

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const staff = <T>(path: string, body: unknown = {}, headers = setup.admin.headers) =>
      settle(http.post<T & { message?: string }>(path, body, { headers }))
    const returnable = (orderId: string) =>
      settle(
        http.get<Returnable>(`/store/orders/${orderId}/returnable`, { headers: customer.headers })
      )
    const ask = (orderId: string, lineId: string) =>
      settle(
        http.post<{ return_request: { id: string }; message?: string }>(
          `/store/orders/${orderId}/returns`,
          { items: [{ line_item_id: lineId, quantity: 1 }], reason: "changed_mind" },
          { headers: customer.headers }
        )
      )
    /** The customer's Geliver order, paid, delivered, asked back and approved. */
    const approvedReturn = async () => {
      const orderId = await geliverOrder(getContainer(), setup, setup.variantId, 1)
      const { data } = await query().graph({
        entity: "order",
        fields: ["items.id", "payment_collections.payments.id"],
        filters: { id: orderId },
      })
      const row = data[0] as {
        items: { id: string }[]
        payment_collections: { payments: { id: string }[] }[]
      }
      await staff(`/admin/payments/${row.payment_collections[0]?.payments[0]?.id ?? ""}/capture`)
      await shipOrder(http, setup, orderId)
      for (let step = 0; step < 4; step += 1) {
        clock += 30 * MINUTE
        await pollShipments(getContainer(), new Date(clock))
      }
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(orderId, { customer_id: customer.id, email: SHOPPER })
      const lineId = row.items[0]?.id ?? ""
      const id = (await ask(orderId, lineId)).data.return_request.id
      const approved = await staff<{ return_request: Request }>(
        `/admin/return-requests/${id}/approve`,
        { note: "Kargo koduyla gönderin" }
      )
      expect(approved.status).toBe(200)
      return { id, orderId, lineId, code: approved.data.return_request.return_code }
    }
    const shipmentOf = async (id: string) => {
      const [request] = await getContainer()
        .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
        .listReturnRequests({ id }, { select: ["return_shipment_id"] })
      return geliver.shipments.get(request?.return_shipment_id ?? "")
    }

    beforeAll(async () => {
      geliver = await startFakeGeliver()
      mail = await startFakeMail()
      Object.assign(process.env, {
        GELIVER_BASE_URL: geliver.url,
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: mail.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of ["GELIVER_BASE_URL", "EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await Promise.all([geliver.close(), mail.close()])
    })

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      setup = await geliverShop(http, getContainer(), geliver)
      customer = await registerCustomer(http, await createStorefront(getContainer()))
      mail.messages.length = 0
    })

    it("takes an approval back: code withdrawn, lines open again, the shopper told", async () => {
      const { id, orderId, lineId, code } = await approvedReturn()
      const held = await returnable(orderId)

      const bare = await staff(`/admin/return-requests/${id}/cancel`, {})
      const canceled = await staff<{ return_request: Request }>(
        `/admin/return-requests/${id}/cancel`,
        { reason: "Müşteri telefonda vazgeçtiğini söyledi" }
      )
      const twice = await staff(`/admin/return-requests/${id}/cancel`, { reason: "Tekrar" })
      const open = await returnable(orderId)
      const shopperSees = await settle(
        http.get<{ return_requests: Record<string, unknown>[] }>(
          `/store/orders/${orderId}/returns`,
          { headers: customer.headers }
        )
      )
      const mails = await eventually(
        () => Promise.resolve(mail.messages.filter(({ to }) => to.includes(SHOPPER))),
        (found) => found.some(({ template }) => template === "return.canceled")
      )

      expect(code).toBeTruthy()
      expect(held.data).toMatchObject({ open_request: true })
      expect(held.data.lines[0]?.returnable).toBe(0)
      expect(bare.status).toBe(400)
      expect(canceled.status).toBe(200)
      expect(canceled.data.return_request).toMatchObject({
        status: "canceled",
        cancel_cause: "staff",
        cancel_reason: "Müşteri telefonda vazgeçtiğini söyledi",
        canceled_by: expect.any(String) as unknown,
        // The approval's note stays as it was
        decision_note: "Kargo koduyla gönderin",
      })
      expect(canceled.data.return_request.items[0]?.gift_card).toBe(false)
      expect([twice.status, twice.data.message]).toEqual([400, "returns.status_invalid"])
      expect((await shipmentOf(id))?.statusCode).toBe("CANCELED")
      // Medusa's return cancelled: the unit can be asked for again
      expect(open.data.open_request).toBe(false)
      expect(open.data.lines).toEqual([
        expect.objectContaining({ line_item_id: lineId, returnable: 1, window_open: true }),
      ])
      expect((await ask(orderId, lineId)).status).toBe(200)
      // The shopper sees it cancelled, without the dead code nor staff's words
      const seen = shopperSees.data.return_requests.find((request) => request["id"] === id)
      expect(seen).toMatchObject({ status: "canceled", return_code: null })
      expect(JSON.stringify(seen)).not.toContain("vazgeçtiğini")
      const told = mails.find(({ template }) => template === "return.canceled")
      expect(told?.subject).toMatch(/^İade talebiniz iptal edildi \(#\d+\)$/)
      expect(told?.text).toContain("geri göndermenize gerek yok")
      expect(told?.text).not.toContain("vazgeçtiğini")
    })

    it("refuses once the carrier has the parcel, and changes nothing", async () => {
      const { id, orderId } = await approvedReturn()
      const parcel = await shipmentOf(id)
      // The shopper handed it over: the carrier has it on its way (the label's steps passed)
      for (let step = 0; step < 3; step += 1) {
        geliver.advance(parcel?.id ?? "")
      }

      const refused = await staff(`/admin/return-requests/${id}/cancel`, { reason: "Vazgeçti" })
      const [request] = await getContainer()
        .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
        .listReturnRequests({ id }, { select: ["status"] })

      expect([refused.status, refused.data.message]).toEqual([400, "returns.cancel_handed_over"])
      expect(request?.status).toBe("approved")
      expect((await returnable(orderId)).data.open_request).toBe(true)
    })

    it("refuses a request not approved, and lets the operations role cancel", async () => {
      const { id } = await approvedReturn()
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const body = { reason: "Yanlışlıkla onaylandı" }

      const byReadonly = await staff(`/admin/return-requests/${id}/cancel`, body, readonly.headers)
      const byOperations = await staff(
        `/admin/return-requests/${id}/cancel`,
        body,
        operations.headers
      )
      const unknown = await staff(`/admin/return-requests/rreq_01UNKNOWN/cancel`, body)

      expect(byReadonly.status).toBe(403)
      expect(byOperations.status).toBe(200)
      expect(unknown.status).toBe(404)
    })
  },
})
