import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { syncAccounting } from "../../src/jobs/accounting-sync"
import { fakeAccountingLedger } from "../../src/lib/accounting"
import { ACCOUNTING_MODULE } from "../../src/modules/accounting"
import type AccountingModuleService from "../../src/modules/accounting/service"
import { MAX_ATTEMPTS } from "../../src/modules/accounting/service"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { upsertCustomerBillingProfileWorkflow } from "../../src/workflows/billing-profile/upsert-customer-billing-profile"
import { syncAccountingRecordWorkflow } from "../../src/workflows/accounting/sync-record"
import { createAdminUser } from "../helpers/admin"
import { CORPORATE, VKN, billingProfileService } from "../helpers/billing-profile"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const minutesLater = (minutes: number) => new Date(Date.now() + minutes * 60_000)

/** F11.5 (adr/0039 §5; KK2): records to the accounting program, tried until they go, never twice. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let admin: { headers: Record<string, string> }
    let variantId: string

    const records = () => getContainer().resolve<AccountingModuleService>(ACCOUNTING_MODULE)
    const rows = () =>
      records().listAccountingSyncs(
        {},
        { select: ["id", "source_type", "source_id", "status", "attempts", "external_ref"] }
      )
    const order = (email: string) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        email,
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
    const pick = (adapter: string) =>
      settle(
        http.post("/admin/platform-settings/accounting", { adapter }, { headers: admin.headers })
      )

    beforeEach(async () => {
      fakeAccountingLedger.reset()
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
      variantId = (await stockedProduct(container, shop, `muhasebe-${String(Date.now())}`, 10, 120))
        .variantId
    })

    it("sends nothing while no program is picked", async () => {
      await order("ayse@example.com")
      await new Promise((resolve) => setTimeout(resolve, 300))

      expect(await rows()).toEqual([])
      expect(await syncAccounting(getContainer())).toEqual({ synced: 0, failed: 0, stopped: 0 })
    })

    it("tries a record the program refused later, and never makes it twice (KK2)", async () => {
      expect((await pick("fake")).status).toBe(200)
      const orderId = await order("ayse@example.com")
      await advanceOrder(getContainer(), orderId, "delivered")
      const queued = await eventually(rows, (list) => list.length === 2)
      fakeAccountingLedger.failNext(1)

      const first = await syncAccounting(getContainer())
      const waiting = (await rows()).find((row) => row.status === "pending")
      const tooSoon = await syncAccounting(getContainer())
      const later = await syncAccounting(getContainer(), minutesLater(2))
      // The event again, and the record sent again as if its answer were lost
      const again = await records().enqueue("fake", [{ source_type: "sale", source_id: orderId }])
      const sale = (await rows()).find((row) => row.source_type === "sale")
      await syncAccountingRecordWorkflow(getContainer()).run({
        input: {
          adapter: "fake",
          sync_id: sale?.id ?? "",
          source_type: "sale",
          source_id: orderId,
        },
      })

      expect(queued.map((row) => row.source_type).sort()).toEqual(["payment", "sale"])
      expect(first).toEqual({ synced: 1, failed: 1, stopped: 0 })
      expect(waiting).toMatchObject({ attempts: 1, external_ref: null })
      expect(tooSoon).toEqual({ synced: 0, failed: 0, stopped: 0 })
      expect(later).toEqual({ synced: 1, failed: 0, stopped: 0 })
      expect(again).toBe(0)
      expect(fakeAccountingLedger.of("sale")).toHaveLength(1)
      expect(fakeAccountingLedger.of("payment")).toHaveLength(1)
      expect(fakeAccountingLedger.of("sale")[0]).toMatchObject({
        reference: sale?.id,
        external_id: sale?.external_ref,
        body: { lines: expect.any(Array) as unknown, total: "210.00" },
      })
    })

    it("stops a record after the last try, rings the bell, and starts it again on request", async () => {
      await pick("fake")
      await order("ayse@example.com")
      await eventually(rows, (list) => list.length === 1)
      fakeAccountingLedger.failNext(100)

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await syncAccounting(getContainer(), minutesLater(24 * 60 * (attempt + 1)))
      }
      const [stopped] = await rows()
      const page = await http.get<{ counts: Record<string, number>; stopped: { id: string }[] }>(
        "/admin/accounting",
        { headers: admin.headers }
      )
      const bell = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "feed" }, { select: ["data"] })
      const retried = await settle(
        http.post(
          `/admin/accounting/syncs/${stopped?.id ?? ""}/retry`,
          {},
          { headers: admin.headers }
        )
      )
      fakeAccountingLedger.failNext(0)
      const after = await syncAccounting(getContainer())

      expect(stopped).toMatchObject({ status: "stopped", attempts: MAX_ATTEMPTS })
      expect(page.data.counts).toEqual({ pending: 0, synced: 0, stopped: 1 })
      expect(page.data.stopped.map((row) => row.id)).toEqual([stopped?.id])
      expect(bell.filter(({ data }) => data?.["kind"] === "accounting_sync")).toHaveLength(1)
      expect(retried.status).toBe(200)
      expect(after).toEqual({ synced: 1, failed: 0, stopped: 0 })
    })

    it("sends a corporate customer's card with the sale, read when it is sent", async () => {
      await pick("fake")
      const orderId = await order("satinalma@ornek-ticaret.example.com")
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["customer_id"], filters: { id: orderId } })
      const customerId = (data[0] as unknown as { customer_id: string }).customer_id
      await upsertCustomerBillingProfileWorkflow(getContainer()).run({
        input: {
          customer_id: customerId,
          data: billingProfileService(getContainer()).prepareProfileData(
            CORPORATE as never,
            customerId
          ),
        },
      })
      await eventually(rows, (list) => list.length === 1)

      await syncAccounting(getContainer())

      const [customer] = fakeAccountingLedger.of("customer")
      expect(customer?.body).toMatchObject({ kind: "corporate", tax_id: VKN })
      expect(fakeAccountingLedger.of("sale")[0]?.body).toMatchObject({
        customer: { external_id: customer?.external_id },
      })
    })
  },
})
