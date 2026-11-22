import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { createAdminUser } from "../helpers/admin"
import { emptyCart, publishTour, traveler } from "../helpers/booking-tour"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"
import type * as CustomerDataModule from "../../src/workflows/legal/customer-data"

jest.setTimeout(240 * 1000)

type Answer = {
  message?: string
  travelers?: Record<string, unknown>[]
  deleted?: number
} & Record<string, unknown>

/** adr/0076 Ek D6b: a traveler's own KVKK request, and the buyer's copy naming their travelers. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: Awaited<ReturnType<typeof createAdminUser>>
    let store: Storefront
    let shop: StockShop

    const staff = (url: string, body: unknown, headers: Record<string, string> = admin.headers) =>
      settle(http.post<Answer>(url, body, { headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })
    const search = (body: unknown, headers?: Record<string, string>) =>
      staff("/admin/booking-travelers/search", body, headers)

    // Mutations are written once the response has finished: they may land a moment later
    const mutationOf = async (action: string) => {
      const audit = getContainer().resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const [entry] = await audit.listAuditEntries({ kind: "mutation", action, outcome: 200 })
        if (entry) {
          return entry
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return undefined
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
    })
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("keeps a traveler's request open while the flag is off (review O2)", async () => {
      const found = await search({ first_name: "Ayşe", last_name: "Yılmaz" })
      const erased = await staff("/admin/booking-travelers/erase", { ids: ["bktrv_x"] })
      expect([found.status, found.data.travelers]).toEqual([200, []])
      expect([erased.status, erased.data.deleted]).toEqual([200, 0])
    })

    it("finds a traveler's rows, copies them masked to the buyer, and deletes them on request", async () => {
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
      const container = getContainer()
      const { adult, slotId } = await publishTour(http, admin.headers, shop, "identity")
      const cartId = await emptyCart(container, shop)
      const [customer] = await container
        .resolve(Modules.CUSTOMER)
        .createCustomers([{ email: "alici@example.com", first_name: "Alıcı" }])
      await container
        .resolve(Modules.CART)
        .updateCarts([{ id: cartId, customer_id: customer?.id ?? "" }])
      const post = (url: string, body: unknown) =>
        settle(http.post<Answer>(url, body, { headers: store.headers }))
      await post(`/store/carts/${cartId}/bookings`, {
        slot_id: slotId,
        items: [{ variant_id: adult, quantity: 3 }],
      })
      const saved = await post(`/store/carts/${cartId}/travelers`, {
        travelers: [
          traveler(slotId, "U12345678"),
          traveler(slotId, "98765432101", { first_name: "Mehmet" }),
          traveler(slotId, "K55554444", { first_name: "İSMAİL", last_name: "KAYA" }),
        ],
      })
      const ops = await createAdminUser(http, container, "operations")

      const byName = await search({ first_name: "ayşe", last_name: "YILMAZ" })
      const byAll = await search({
        first_name: "Ayşe",
        last_name: "Yılmaz",
        birth_date: "1990-01-15",
        document_no: "u1234 5678",
      })
      const otherNumber = await search({
        first_name: "Ayşe",
        last_name: "Yılmaz",
        document_no: "X99999999",
      })
      const notADay = await search({
        first_name: "Ayşe",
        last_name: "Yılmaz",
        birth_date: "1990-13-01",
      })
      const byOps = await search({ first_name: "Ayşe", last_name: "Yılmaz" }, ops.headers)
      // Turkish case: "ismail" finds "İSMAİL", and so does "ISMAIL" (review D2)
      const ismail = await search({ first_name: "ismail", last_name: "Kaya" })
      const dotless = await search({ first_name: "ISMAIL", last_name: "kaya" })
      // Loaded once the app is up: its module links need the modules registered first
      const { customerData } =
        (await import("../../src/workflows/legal/customer-data")) as typeof CustomerDataModule
      const copy = await customerData(container, customer?.id ?? "")
      const audit = getContainer().resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const reads = await audit.listAuditEntries({
        kind: "sensitive_read",
        action: "POST /admin/booking-travelers/search",
      })

      expect(saved.status).toBe(200)
      expect(byName.status).toBe(200)
      expect(byName.data.travelers).toEqual([
        expect.objectContaining({
          first_name: "Ayşe",
          last_name: "Yılmaz",
          birth_date: "1990-01-15",
          document_masked: "***5678",
          order_id: null,
        }),
      ])
      expect(byName.headers["cache-control"]).toBe("no-store")
      expect(byAll.data.travelers).toHaveLength(1)
      expect(otherNumber.data.travelers).toEqual([])
      expect([notADay.status, notADay.data.message]).toEqual([
        400,
        "booking.traveler_search_invalid",
      ])
      expect(byOps.status).toBe(403)
      expect(ismail.data.travelers).toEqual([
        expect.objectContaining({ first_name: "İSMAİL", last_name: "KAYA" }),
      ])
      expect(dotless.data.travelers).toHaveLength(1)
      expect(JSON.stringify([byName.data, byAll.data])).not.toMatch(
        /U12345678|document_encrypted|document_hash/
      )
      // The buyer's copy: both travelers, the number masked
      expect(copy.katılımcılar).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ad: "Ayşe", kimlik_ya_da_pasaport_no: "***5678" }),
          expect.objectContaining({ ad: "Mehmet", kimlik_ya_da_pasaport_no: "***2101" }),
        ])
      )
      expect(JSON.stringify(copy.katılımcılar)).not.toMatch(/U12345678|98765432101/)
      // Recorded with how many, never who
      expect(reads.length).toBeGreaterThanOrEqual(3)
      expect(JSON.stringify(reads.map((entry) => entry.changes))).not.toMatch(/Ayşe|Yılmaz|1990/)

      // The shop stops selling dated products: the rows entered stay theirs to ask for (O2)
      await flag("catalog.booking", false)
      const ayse = (byName.data.travelers?.[0]?.["id"] as string | undefined) ?? ""
      const bare = await staff("/admin/booking-travelers/erase", { ids: [ayse] }, admin.plain)
      const erasedByOps = await staff(
        "/admin/booking-travelers/erase",
        { ids: [ayse] },
        ops.headers
      )
      const erased = await staff("/admin/booking-travelers/erase", { ids: [ayse] })
      const after = await search({ first_name: "Ayşe", last_name: "Yılmaz" })
      const mehmet = await search({ first_name: "Mehmet", last_name: "Yılmaz" })

      expect(bare.status).toBe(428)
      expect(erasedByOps.status).toBe(403)
      expect([erased.status, erased.data.deleted]).toEqual([200, 1])
      expect(after.status).toBe(200)
      expect(after.data.travelers).toEqual([])
      // Recorded with the departure's and bookings' ids, never who (review D1)
      const written = await mutationOf("POST /admin/booking-travelers/erase")
      expect(written?.changes).toEqual(
        expect.objectContaining({
          result: { deleted: 1, booking_ids: [], slot_ids: [slotId] },
        })
      )
      expect(JSON.stringify(written?.changes)).not.toMatch(/Ayşe|Yılmaz|1990|5678/)
      // Only the asking person's row goes
      expect(mehmet.data.travelers).toHaveLength(1)
    })
  },
})
