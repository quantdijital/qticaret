import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeAras } from "@qticaret/testing"
import type { FakeAras } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { geliverProduct } from "../helpers/geliver"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const MINUTE = 60 * 1000

interface FulfillmentRow {
  id: string
  shipped_at: Date | null
  delivered_at: Date | null
  canceled_at: Date | null
  data: Record<string, unknown>
}

/** F7.14 (adr/0035): a parcel shipped on the shop's own Aras contract, labelled and tracked. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeAras
    let shop: StockShop
    let admin: { headers: Record<string, string> }
    let optionId: string
    let variantId: string
    let clock = Date.now()

    const post = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: admin.headers }))
    const connect = (password: string) =>
      post("/admin/integrations/credentials/aras", {
        settings: { test_mode: true, customer_code: "123456", service_url: "" },
        secrets: { username: fake.account.username, password },
      })
    const order = () =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: optionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
      })
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
      fake = await startFakeAras()
      process.env["ARAS_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["ARAS_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
      await ensureLocationCarriers(container)
      await connect(fake.account.password)
      const created = await post<{ id: string }>("/admin/shipping-setup/options", {
        name: "Aras Kargo",
        carrier: "aras",
        pricing: { type: "flat", amount: 59.9 },
      })
      optionId = created.data.id
      variantId = await geliverProduct(container, shop)
      fake.orders.clear()
      fake.requests.length = 0
    })

    it("refuses an account Aras does not know, and lists the option as Aras's", async () => {
      const refused = await connect("yanlis-sifre")
      const { data } = await http.get<{ options: { id: string; carrier: string }[] }>(
        "/admin/shipping-setup/options",
        { headers: admin.headers }
      )

      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ message: "aras.secret_invalid" })
      expect(data.options.find(({ id }) => id === optionId)).toMatchObject({ carrier: "aras" })
    })

    it("ships under our code, keeps Aras's label privately, and follows the parcel to delivered", async () => {
      const orderId = await order()

      const shipped = await post<{ carrier: string; fulfillment_id: string }>(
        `/admin/orders/${orderId}/ship`,
        { notify: false }
      )
      const [packed] = await fulfillmentsOf(orderId)
      const [sent] = [...fake.orders.values()]
      const label = await settle(
        http.get<{ url: string }>(
          `/admin/orders/${orderId}/fulfillments/${packed?.id ?? ""}/label`,
          { headers: admin.headers }
        )
      )
      for (let step = 0; step < 4; step += 1) {
        clock += 30 * MINUTE
        await pollShipments(getContainer(), new Date(clock))
      }
      const [arrived] = await fulfillmentsOf(orderId)

      expect(shipped.data).toMatchObject({ carrier: "aras" })
      expect(sent).toMatchObject({ receiverName: "Ayşe Yılmaz", isCod: false })
      expect(packed?.data).toMatchObject({
        shipment_id: sent?.integrationCode,
        test: true,
        label_base64: null,
      })
      expect(String(packed?.data["shipment_id"])).toMatch(/^QT[A-Z2-9]{14}$/)
      expect(packed?.data["label_file_id"]).toEqual(expect.any(String))
      expect(label.status).toBe(200)
      // Handed over when Aras took it, delivered when Aras said so
      expect(arrived?.shipped_at).toBeTruthy()
      expect(arrived?.delivered_at).toBeTruthy()
    })

    it("withdraws the order at Aras when its label cannot be had, and packs nothing", async () => {
      const orderId = await order()
      fake.queue("GetArasBarcode", "1")

      const refused = await post(`/admin/orders/${orderId}/ship`, { notify: false })
      const [sent] = [...fake.orders.values()]

      expect(refused.status).toBeGreaterThanOrEqual(400)
      expect(sent?.canceled).toBe(true)
      expect(await fulfillmentsOf(orderId)).toHaveLength(0)
    })
  },
})
