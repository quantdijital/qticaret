import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PDFDocument } from "pdf-lib"
import { startFakeAras, startFakeDhlEcom, startFakeYurtici } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { MM } from "../../src/lib/pdf"
import { DHL_ECOMMERCE_DEV_APP } from "../../src/lib/shipping/dhlecommerce"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { measuredProduct } from "../helpers/carrier"
import type { HttpClient, HttpResponse } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const MINUTE = 60 * 1000

type Post = <T>(path: string, body: unknown) => Promise<HttpResponse<T & { message?: string }>>

/** One carrier as the contract drives it: its fake service and how to read it. */
interface CarrierUnderTest {
  name: "aras" | "yurtici" | "dhlecommerce"
  env: string
  start: () => Promise<string>
  stop: () => Promise<void>
  connect: (post: Post) => Promise<unknown>
  pricing: Record<string, unknown>
  /** Forgets the parcels of earlier tests. */
  reset: () => void
  /** Parcels open at the carrier: opened and not withdrawn. */
  open: () => number
  /** The next shipping fails after the carrier may have opened the parcel. */
  failAfterOpening: () => void
  secrets: () => string[]
}

function aras(): CarrierUnderTest {
  let fake: Awaited<ReturnType<typeof startFakeAras>>
  return {
    name: "aras",
    env: "ARAS_BASE_URL",
    start: async () => {
      fake = await startFakeAras()
      return fake.url
    },
    stop: () => fake.close(),
    connect: (post) =>
      post("/admin/integrations/credentials/aras", {
        settings: { test_mode: true, customer_code: "123456", service_url: "" },
        secrets: { ...fake.account },
      }),
    pricing: { type: "flat", amount: 59.9 },
    reset: () => {
      fake.orders.clear()
    },
    open: () => [...fake.orders.values()].filter((each) => !each.canceled).length,
    // The order is open; its label is refused
    failAfterOpening: () => {
      fake.queue("GetArasBarcode", "1")
    },
    secrets: () => [fake.account.username, fake.account.password],
  }
}

function yurtici(): CarrierUnderTest {
  let fake: Awaited<ReturnType<typeof startFakeYurtici>>
  return {
    name: "yurtici",
    env: "YURTICI_BASE_URL",
    start: async () => {
      fake = await startFakeYurtici()
      return fake.url
    },
    stop: () => fake.close(),
    connect: (post) =>
      post("/admin/integrations/credentials/yurtici", {
        settings: { test_mode: true },
        secrets: { ...fake.accounts.main },
      }),
    pricing: { type: "table" },
    reset: () => {
      fake.shipments.clear()
    },
    open: () => [...fake.shipments.values()].filter((each) => !each.canceled).length,
    // The parcel is opened; its answer never comes back
    failAfterOpening: () => {
      fake.queue("createShipment", "lost")
    },
    secrets: () => [fake.accounts.main.username, fake.accounts.main.password],
  }
}

function dhlEcom(): CarrierUnderTest {
  let fake: Awaited<ReturnType<typeof startFakeDhlEcom>>
  return {
    name: "dhlecommerce",
    // No app keys set: with a fake, the backend's development app (the fake's)
    env: "DHL_ECOMMERCE_BASE_URL",
    start: async () => {
      fake = await startFakeDhlEcom({ ...DHL_ECOMMERCE_DEV_APP })
      return fake.url
    },
    stop: () => fake.close(),
    connect: (post) =>
      post("/admin/integrations/credentials/dhlecommerce", {
        settings: { test_mode: true },
        secrets: { customer_number: fake.account.customerNumber, password: fake.account.password },
      }),
    pricing: { type: "table" },
    reset: () => {
      fake.orders.clear()
    },
    open: () => [...fake.orders.values()].filter((each) => !each.canceled).length,
    // The order is open; its barcode is refused
    failAfterOpening: () => {
      fake.queue("createbarcode", "30099")
    },
    secrets: () => [fake.account.customerNumber, fake.account.password],
  }
}

interface FulfillmentRow {
  id: string
  shipped_at: Date | null
  delivered_at: Date | null
  canceled_at: Date | null
  data: Record<string, unknown>
}

/**
 * F7 KK7 (adr/0031, adr/0035): what every carrier the shop ships with
 * promises, whichever it is: no parcel once the shop's account is gone, our
 * route only, nothing left open at the carrier when shipping fails, the
 * label kept privately and no secret on the fulfillment, the parcel
 * followed to its end, and withdrawn when the shop cancels in time.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    describe.each([aras(), yurtici(), dhlEcom()])("carrier contract: $name", (carrier) => {
      let shop: StockShop
      let admin: { headers: Record<string, string> }
      let optionId: string
      let variantId: string
      let clock = Date.now()

      const post: Post = (path, body) => settle(http.post(path, body, { headers: admin.headers }))
      const order = () =>
        placeOrder(getContainer(), {
          regionId: shop.regionId,
          salesChannelId: shop.salesChannelId,
          shippingOptionId: optionId,
          items: [{ variant_id: variantId, quantity: 1 }],
          address: PAYTR_ADDRESS,
        })
      const ship = (orderId: string) => post(`/admin/orders/${orderId}/ship`, { notify: false })
      const fulfillmentsOf = async (orderId: string) => {
        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({
            entity: "order",
            fields: [
              "fulfillments.id",
              "fulfillments.shipped_at",
              "fulfillments.delivered_at",
              "fulfillments.canceled_at",
              "fulfillments.data",
            ],
            filters: { id: orderId },
          })
        return ((data[0] as { fulfillments?: FulfillmentRow[] }).fulfillments ?? []).filter(
          (each) => !each.canceled_at
        )
      }

      beforeAll(async () => {
        process.env[carrier.env] = await carrier.start()
      })

      afterAll(async () => {
        Reflect.deleteProperty(process.env, carrier.env)
        await carrier.stop()
      })

      beforeEach(async () => {
        const container = getContainer()
        await loadTrAddressFixture(container)
        shop = await stockShop(container)
        admin = await createAdminUser(http, container)
        await ensureLocationCarriers(container)
        // A table for the carriers priced by it: a 1 desi parcel costs 49.90
        await post("/admin/platform-settings/shipping", {
          rate_table: [{ max_desi: 10, price: 4_990 }],
        })
        const created = await post<{ id: string }>("/admin/shipping-setup/options", {
          name: carrier.name,
          carrier: carrier.name,
          pricing: carrier.pricing,
        })
        optionId = created.data.id
        variantId = await measuredProduct(container, shop)
        carrier.reset()
      })

      it("opens no parcel once the shop's account is gone", async () => {
        // A quoting carrier prices the cart with the account: the order comes first
        await carrier.connect(post)
        const orderId = await order()
        await settle(
          http.delete(`/admin/integrations/credentials/${carrier.name}`, { headers: admin.headers })
        )

        const refused = await ship(orderId)

        expect(refused.status).toBe(400)
        expect(refused.data.message).toBe("shipping.carrier_not_connected")
        expect(carrier.open()).toBe(0)
      })

      it("ships on our route only, keeps the label privately, holds no secret, and follows the parcel to its end", async () => {
        await carrier.connect(post)
        const orderId = await order()
        const { data: lines } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
        const items = (lines[0] as { items: { id: string }[] }).items

        const medusas = await post(`/admin/orders/${orderId}/fulfillments`, {
          items: items.map(({ id }) => ({ id, quantity: 1 })),
        })
        const shipped = await ship(orderId)
        const [packed] = await fulfillmentsOf(orderId)
        const labelPath = `/admin/orders/${orderId}/fulfillments/${packed?.id ?? ""}/label`
        const label = await settle(http.get<{ url: string }>(labelPath, { headers: admin.headers }))
        const anonymous = await settle(http.get(labelPath))
        const bulkPath = `/admin/shipping-labels?fulfillment_id=${packed?.id ?? ""}`
        const bulk = await settle(
          http.get<string>(bulkPath, { headers: admin.headers, responseType: "text" })
        )
        const bulkAnonymous = await settle(http.get(bulkPath))
        // On the shop's label size: four to an A4 sheet for an office printer
        await getContainer()
          .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
          .saveSection("shipping", { label_format: "a4" }, null)
        const sheet = await http.get<ArrayBuffer>(bulkPath, {
          headers: admin.headers,
          responseType: "arraybuffer",
        })
        const [a4] = (await PDFDocument.load(sheet.data)).getPages()
        for (let read = 0; read < 8; read += 1) {
          clock += 30 * MINUTE
          await pollShipments(getContainer(), new Date(clock))
        }
        const [arrived] = await fulfillmentsOf(orderId)

        expect(JSON.stringify(medusas.data)).toMatch(/shipping\.use_ship_route/)
        expect(shipped.status).toBe(200)
        expect(shipped.data).toMatchObject({ carrier: carrier.name })
        expect(carrier.open()).toBe(1)
        expect(packed?.data["shipment_id"]).toEqual(expect.any(String))
        expect(packed?.data["label_file_id"]).toEqual(expect.any(String))
        expect(packed?.data["label_base64"] ?? null).toBeNull()
        expect(packed?.data["label_source"] ?? null).toBeNull()
        // The label opens for staff by a short-lived link, never for anyone else
        expect(label.status).toBe(200)
        expect(anonymous.status).toBe(401)
        // Picked parcels print as one PDF (F7.7, pdf-lib): every carrier's label merges
        expect(bulk.status).toBe(200)
        expect(bulk.headers["content-type"]).toMatch(/^application\/pdf/)
        expect(bulk.headers["x-labels-missing"]).toBe("0")
        expect(bulk.data.startsWith("%PDF-")).toBe(true)
        expect(bulkAnonymous.status).toBe(401)
        expect(
          [a4?.getWidth(), a4?.getHeight()].map((side) => Math.round((side ?? 0) / MM))
        ).toEqual([210, 297])
        for (const secret of carrier.secrets()) {
          expect(JSON.stringify(packed?.data)).not.toContain(secret)
        }
        expect(arrived?.shipped_at).toBeTruthy()
        expect(arrived?.delivered_at).toBeTruthy()
      })

      it("leaves nothing open at the carrier when shipping fails after it opened the parcel", async () => {
        await carrier.connect(post)
        const orderId = await order()
        carrier.failAfterOpening()

        const failed = await ship(orderId)

        expect(failed.status).toBeGreaterThanOrEqual(400)
        expect(carrier.open()).toBe(0)
        expect(await fulfillmentsOf(orderId)).toHaveLength(0)
      })

      it("withdraws the parcel at the carrier when the shop cancels before handing it over", async () => {
        await carrier.connect(post)
        const orderId = await order()
        await ship(orderId)
        const [packed] = await fulfillmentsOf(orderId)

        const canceled = await post(
          `/admin/orders/${orderId}/fulfillments/${packed?.id ?? ""}/cancel`,
          {}
        )

        expect(canceled.status).toBe(200)
        expect(carrier.open()).toBe(0)
        expect(await fulfillmentsOf(orderId)).toHaveLength(0)
      })
    })
  },
})
