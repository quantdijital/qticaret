import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { createAdminUser } from "../helpers/admin"
import { birfaturaClient, gibNumber } from "../helpers/birfatura"
import { birfaturaShop } from "../helpers/birfatura-shop"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const EXCHANGE_BASE = 1_000_000_000_000

/** F1 of the BirFatura pull (adr/0072): its door, its pull, its write-back. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const birfatura = birfaturaClient(http)
    const bf = birfaturaShop(http, getContainer)
    const { einvoice, invoiceOf, settings, makeToken } = bf
    const paidOrder = bf.order
    bf.hooks()

    it("keeps its door shut: 404 until chosen, 401 without the token, the owner alone makes it", async () => {
      await settings("external")
      const before = await birfatura.pull("00000000-0000-0000-0000-000000000000")
      const admin = await createAdminUser(http, getContainer(), "admin")
      const byAdmin = await settle(
        http.post("/admin/einvoice/birfatura/token", {}, { headers: admin.headers })
      )
      const noProof = await settle(
        http.post("/admin/einvoice/birfatura/token", {}, { headers: bf.state.owner.plain })
      )
      // Another program in use: no token is made for BirFatura (security review I-2)
      const whileExternal = await settle(
        http.post("/admin/einvoice/birfatura/token", {}, { headers: bf.state.owner.headers })
      )
      await settings("birfatura")
      const token = await makeToken()
      const none = await birfatura.pull(undefined as unknown as string)
      const wrong = await birfatura.pull("11111111-2222-3333-4444-555555555555")
      const inQuery = await settle(http.post(`/hooks/birfatura/api/orderStatus?token=${token}`, {}))
      const statuses = await birfatura.call<{ OrderStatus: { Id: number; Value: string }[] }>(
        "orderStatus",
        {},
        token
      )
      const methods = await birfatura.call<{ PaymentMethods: { Id: number }[] }>(
        "paymentMethods",
        {},
        token
      )
      const extraField = await birfatura.call<{ Orders: unknown[] }>(
        "orders",
        {
          orderStatusId: 1,
          startDateTime: "01.11.2026 00:00:00",
          endDateTime: "02.11.2026 00:00:00",
          extra: 1,
        },
        token
      )
      const tooWide = await birfatura.call(
        "orders",
        {
          orderStatusId: 1,
          startDateTime: "01.01.2026 00:00:00",
          endDateTime: "01.03.2026 00:00:00",
        },
        token
      )
      const view = await http.get<{ birfatura: { token: unknown } }>("/admin/einvoice/birfatura", {
        headers: bf.state.owner.headers,
      })
      const renewed = await makeToken()
      const old = await birfatura.pull(token)
      const fresh = await birfatura.pull(renewed)
      const bell = await getContainer().resolve(Modules.NOTIFICATION).listNotifications({
        trigger_type: "integration_credentials.changed",
        resource_id: "birfatura",
      })

      expect(before.status).toBe(404)
      expect(byAdmin.status).toBe(403)
      expect(noProof.status).toBe(428)
      expect(whileExternal.status).toBe(409)
      expect(whileExternal.data).toMatchObject({ message: "einvoice.birfatura_not_selected" })
      expect(token).toMatch(GUID)
      expect(none.status).toBe(401)
      expect(none.data).toBeFalsy()
      expect(wrong.status).toBe(401)
      expect(inQuery.status).toBe(401)
      expect(statuses.data.OrderStatus.map((status) => status.Id)).toEqual([1, 2, 3])
      expect(methods.data.PaymentMethods.map((method) => method.Id)).toEqual([1, 2, 3, 4, 5])
      // A field BirFatura adds that its document does not have is ignored, never a 400
      expect(extraField.status).toBe(200)
      expect(Array.isArray(extraField.data.Orders)).toBe(true)
      expect(tooWide.status).toBe(400)
      expect(JSON.stringify(view.data)).not.toContain(token)
      expect(view.data.birfatura.token).toMatchObject({ state: "connected" })
      expect(renewed).not.toBe(token)
      expect(old.status).toBe(401)
      expect(fresh.status).toBe(200)
      expect(bell.length).toBeGreaterThanOrEqual(2)
    })

    it("lists only what waits, records each pull, and takes the invoice back once", async () => {
      await settings("birfatura")
      const token = await makeToken()
      const first = await paidOrder()
      const other = await paidOrder()
      const unpaid = await paidOrder(false)
      const cancelled = await paidOrder()
      await einvoice().updateInvoices({
        id: (await invoiceOf(cancelled.id))?.id ?? "",
        status: "cancelled",
      })
      // A return's document is never BirFatura's to issue, whatever its program
      await einvoice().enqueue({
        order_id: other.id,
        kind: "return",
        source_id: "rr_birfatura",
        provider: "birfatura",
        totals: { net: "1.00", vat: "0.20", gross: "1.20" },
        document_type: "expense_voucher",
      })

      const pulled = await birfatura.pull(token)
      const issuedState = await birfatura.pull(token, 2)
      const [entry] = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries(
          { action: "birfatura.orders_pulled" },
          { order: { created_at: "DESC" }, take: 1 }
        )
      const ids = pulled.data.Orders.map((order) => order.OrderId)

      expect(pulled.status).toBe(200)
      expect(ids).toEqual(expect.arrayContaining([first.number, other.number]))
      expect(ids).not.toContain(unpaid.number)
      expect(ids).not.toContain(cancelled.number)
      expect(ids.filter((id) => id === other.number)).toHaveLength(1)
      expect(pulled.data.Orders.find((order) => order.OrderId === first.number)).toMatchObject({
        OrderCode: String(first.number),
        BillingName: "Ayşe Yılmaz",
        BillingMobilePhone: "+905551112233",
      })
      // The system test payment is none of the named ways: "Diğer"
      expect(
        pulled.data.Orders.find((order) => order.OrderId === first.number)?.PaymentTypeId
      ).toBe(5)
      expect(issuedState.data.Orders).toEqual([])
      expect(entry).toMatchObject({
        kind: "sensitive_read",
        actor_type: "system",
        actor_id: "birfatura",
      })
      expect(JSON.stringify(entry?.changes)).not.toContain("Ayşe")
      expect(JSON.stringify(entry)).not.toContain(token)

      const number = gibNumber("ABC", 72_001)
      const issued = await birfatura.link(token, {
        orderId: first.number,
        faturaUrl: bf.state.files.link("a"),
        faturaNo: number,
      })
      const again = await birfatura.link(token, {
        orderId: first.number,
        faturaUrl: bf.state.files.link("a"),
        faturaNo: number,
      })
      const another = await birfatura.link(token, {
        orderId: first.number,
        faturaUrl: bf.state.files.link("a"),
        faturaNo: gibNumber("ABC", 72_002),
      })
      const otherSeries = await birfatura.link(token, {
        orderId: other.number,
        faturaUrl: bf.state.files.link("b"),
        faturaNo: gibNumber("XYZ", 72_003),
      })
      const unknown = await birfatura.link(token, {
        orderId: 987_654_321,
        faturaUrl: bf.state.files.link("c"),
        faturaNo: gibNumber("ABC", 72_004),
      })
      const after = await birfatura.pull(token)
      const row = await invoiceOf(first.id)
      const refused = await invoiceOf(other.id)
      const told = await eventually(
        () =>
          getContainer()
            .resolve<MessagingModuleService>(MESSAGING_MODULE)
            .listMessageSkips({ template: "order.invoiced", resource_id: row?.id ?? "" }),
        (rows) => rows.length > 0
      )
      const pdf = await getContainer()
        .resolve(Modules.FILE)
        .getAsBuffer(row?.pdf_file_id ?? "")

      expect(issued.data).toMatchObject({ Success: true })
      expect(again.data).toMatchObject({ Success: true })
      expect(another.data).toMatchObject({ Success: false })
      expect(otherSeries.data).toMatchObject({ Success: false })
      expect(unknown.data).toMatchObject({ Success: false })
      expect(row).toMatchObject({ status: "issued", number, document_type: null, uuid: null })
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
      expect(told.length).toBeGreaterThan(0)
      // Reported, refused for its series: never listed again, staff see why
      expect(refused).toMatchObject({ status: "pending", last_error: "einvoice.series_mismatch" })
      expect(refused?.reported_at).toBeTruthy()
      expect(after.data.Orders.map((order) => order.OrderId)).not.toContain(first.number)
      expect(after.data.Orders.map((order) => order.OrderId)).not.toContain(other.number)
    })

    it("fetches the PDF from BirFatura's hosts only, names an exchange apart, and refuses a pull it cannot record", async () => {
      await settings("birfatura")
      const token = await makeToken()
      const order = await paidOrder()
      const exchange = await einvoice().enqueue({
        order_id: order.id,
        kind: "sale",
        source_id: "rr_exchange_1",
        provider: "birfatura",
        totals: { net: "10.00", vat: "2.00", gross: "12.00" },
      })

      const elsewhere = await birfatura.link(token, {
        orderId: order.number,
        faturaUrl: "https://files.example.com/fatura.pdf",
        faturaNo: gibNumber("ABC", 72_101),
      })
      const second = await birfatura.link(token, {
        orderId: EXCHANGE_BASE + order.number * 100 + 1,
        faturaUrl: bf.state.files.link("d"),
        faturaNo: gibNumber("ABC", 72_102),
      })
      const record = jest
        .spyOn(getContainer().resolve<AuditLogModuleService>(AUDIT_LOG_MODULE), "record")
        .mockRejectedValueOnce(new Error("audit store down"))
      const unrecorded = await birfatura.pull(token)
      record.mockRestore()

      const sale = await invoiceOf(order.id)
      const exchanged = await invoiceOf(order.id, "rr_exchange_1")

      expect(elsewhere.data).toMatchObject({ Success: false })
      expect(sale).toMatchObject({
        status: "issued",
        number: gibNumber("ABC", 72_101),
        pdf_file_id: null,
        last_error: "einvoice.pdf_download_failed",
      })
      expect(second.data).toMatchObject({ Success: true })
      expect(exchange.created).toBe(true)
      expect(exchanged).toMatchObject({ status: "issued", number: gibNumber("ABC", 72_102) })
      expect(unrecorded.status).toBe(503)
      expect(JSON.stringify(unrecorded.data)).not.toContain("Ayşe")
    })
  },
})
