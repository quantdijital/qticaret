import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeAras } from "@qticaret/testing"
import type { FakeAras } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { orderShipments } from "../../src/workflows/shipping/order-shipments"
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
      // As the shopper's order page reads it
      const [parcel] = await orderShipments(getContainer(), orderId)

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
      expect(parcel).toMatchObject({ carrier: "Aras Kargo", status: "delivered" })
      expect(parcel?.shipped_at && parcel.delivered_at).toBeTruthy()
      expect(JSON.stringify(parcel)).not.toContain("label_file_id")
    })

    it("fills the receiver's name and phone from the billing address, and refuses only what a courier cannot do without", async () => {
      const blank = async (orderId: string, patch: Record<string, string | null>) => {
        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "order", fields: ["shipping_address.id"], filters: { id: orderId } })
        await getContainer()
          .resolve(Modules.ORDER)
          .updateOrderAddresses({
            id: (data[0] as { shipping_address: { id: string } }).shipping_address.id,
            ...patch,
          })
      }
      const filled = await order()
      await blank(filled, { first_name: null, last_name: null, phone: null })
      const abroad = await order()
      await blank(abroad, { country_code: "de" })

      const shipped = await post(`/admin/orders/${filled}/ship`, { notify: false })
      const refused = await post(`/admin/orders/${abroad}/ship`, { notify: false })
      const [sent] = [...fake.orders.values()]

      expect(shipped.status).toBe(200)
      expect(sent).toMatchObject({ receiverName: "Ayşe Yılmaz", phone: "05320000000" })
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("shipping.receiver_abroad")
      expect(fake.orders.size).toBe(1)
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

    it("sends the product's own desi and weight, else the shop's default parcel (adr/0054)", async () => {
      const setOrderOf = (index: number) =>
        fake.requests.filter((request) => request.operation === "SetOrder")[index]?.body ?? ""
      const sizes = (body: string) =>
        ["VolumetricWeight", "Weight"].map(
          (name) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(body)?.[1]
        )
      const ship = async () =>
        (await post(`/admin/orders/${await order()}/ship`, { notify: false })).status

      // 450 g in a 35 × 8 × 4 cm box: the weight's 0.5 desi
      expect(await ship()).toBe(200)
      variantId = await geliverProduct(getContainer(), shop, false)
      // None of its own: the platform's 1 kg in 30 × 20 × 10 cm, 2 desi
      expect(await ship()).toBe(200)
      await post("/admin/platform-settings/shipping", {
        default_parcel: { weight: 3000, length: 40, width: 30, height: 20 },
      })
      // The shop's own: 3 kg in 40 × 30 × 20 cm, 8 desi
      expect(await ship()).toBe(200)

      expect(sizes(setOrderOf(0))).toEqual(["0.50", "0.45"])
      expect(sizes(setOrderOf(1))).toEqual(["2.00", "1.00"])
      expect(sizes(setOrderOf(2))).toEqual(["8.00", "3.00"])
    })

    it("tells staff what Aras said when it refuses the stored account, the account kept out", async () => {
      const orderId = await order()
      const stored = fake.account.password
      // Aras's password changed; the panel still holds the old one
      fake.account.password = "aras-yeni-sifre"
      try {
        const refused = await post<{ provider?: string; provider_message?: string }>(
          `/admin/orders/${orderId}/ship`,
          { notify: false }
        )
        const bulk = await post<{ results: { ok: boolean; error: string; message: string }[] }>(
          "/admin/order-board/ship",
          { order_ids: [orderId], notify: false }
        )

        expect(refused.status).toBe(502)
        expect(refused.data).toMatchObject({
          type: "provider_error",
          message: "provider.failed",
          provider: "aras",
          provider_message: "Kullanıcı adı veya şifre hatalı",
        })
        expect(bulk.data.results[0]).toMatchObject({
          ok: false,
          error: "provider.failed",
          message: "Aras Kargo yanıtı: “Kullanıcı adı veya şifre hatalı”",
        })
        for (const answer of [refused.data, bulk.data]) {
          const text = JSON.stringify(answer)
          for (const secret of [stored, fake.account.username, fake.url]) {
            expect(text).not.toContain(secret)
          }
        }
        expect(await fulfillmentsOf(orderId)).toHaveLength(0)
      } finally {
        fake.account.password = stored
      }
    })
  },
})
