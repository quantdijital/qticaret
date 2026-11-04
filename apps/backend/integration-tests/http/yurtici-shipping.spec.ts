import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { addShippingMethodToCartWorkflow, createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeYurtici } from "@qticaret/testing"
import type { FakeYurtici } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import type { PlaceOrderInput } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { geliverProduct } from "../helpers/geliver"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
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

/** F7.14 (adr/0035): a parcel shipped on the shop's own Yurtiçi contract, labelled by us, tracked. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeYurtici
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }
    let optionId: string
    let variantId: string
    let clock = Date.now()

    const post = <T>(path: string, body: unknown) =>
      settle(
        http.post<T & { message?: string; field?: string }>(path, body, { headers: admin.headers })
      )
    const connect = (secrets: Partial<Record<string, string>>) =>
      post("/admin/integrations/credentials/yurtici", { settings: { test_mode: true }, secrets })
    const order = (address: PlaceOrderInput["address"] = PAYTR_ADDRESS) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: optionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address,
      })
    const codOrder = async () => {
      await post("/admin/features/payments.cash_on_delivery", { enabled: true })
      await post("/admin/platform-settings/cash_on_delivery", {
        fee_type: "none",
        fee_value: 0,
        max_amount: 0,
        shipping_option_ids: [optionId],
      })
      const { result: cart } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: storefront.salesChannelId,
          currency_code: "try",
          email: "ayse.yilmaz@example.com",
          items: [{ variant_id: variantId, quantity: 1 }],
          shipping_address: PAYTR_ADDRESS,
          billing_address: PAYTR_ADDRESS,
        },
      })
      await addShippingMethodToCartWorkflow(getContainer()).run({
        input: { cart_id: cart.id, options: [{ id: optionId }] },
      })
      await http.post(
        `/store/carts/${cart.id}/payment-session`,
        { provider_id: "pp_cod_cod" },
        { headers: storefront.headers }
      )
      const placed = await http.post<{ order: { id: string; total: number } }>(
        `/store/carts/${cart.id}/complete`,
        {},
        { headers: storefront.headers }
      )
      return placed.data.order
    }
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
    const poll = async (times: number) => {
      for (let step = 0; step < times; step += 1) {
        clock += 30 * MINUTE
        await pollShipments(getContainer(), new Date(clock))
      }
    }

    beforeAll(async () => {
      fake = await startFakeYurtici()
      process.env["YURTICI_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["YURTICI_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await ensureLocationCarriers(container)
      await connect({ ...fake.accounts.main })
      const created = await post<{ id: string }>("/admin/shipping-setup/options", {
        name: "Yurtiçi Kargo",
        carrier: "yurtici",
        pricing: { type: "flat", amount: 59.9 },
      })
      optionId = created.data.id
      variantId = await geliverProduct(container, shop)
      fake.shipments.clear()
      fake.requests.length = 0
    })

    it("refuses logins Yurtiçi does not know, naming the field, and lists the option as Yurtiçi's", async () => {
      const wrongMain = await connect({ ...fake.accounts.main, password: "yanlis-sifre" })
      const wrongDoor = await connect({
        ...fake.accounts.main,
        cod_username: fake.accounts.cod.username,
        cod_password: "yanlis-sifre",
      })
      const halfDoor = await connect({ cod_username: fake.accounts.cod.username })
      const { data } = await http.get<{ options: { id: string; carrier: string }[] }>(
        "/admin/shipping-setup/options",
        { headers: admin.headers }
      )

      expect(wrongMain.data).toMatchObject({ message: "yurtici.secret_invalid" })
      expect(wrongDoor.data).toMatchObject({ message: "yurtici.merchant_invalid" })
      expect(halfDoor.data).toMatchObject({ message: "integration_credentials.secrets_required" })
      expect(data.options.find(({ id }) => id === optionId)).toMatchObject({ carrier: "yurtici" })
    })

    it("ships under our key, keeps our label privately, and follows the parcel to delivered", async () => {
      const orderId = await order()

      const shipped = await post<{ carrier: string }>(`/admin/orders/${orderId}/ship`, {
        notify: false,
      })
      const [packed] = await fulfillmentsOf(orderId)
      const [sent] = [...fake.shipments.values()]
      const label = await settle(
        http.get<{ url: string }>(
          `/admin/orders/${orderId}/fulfillments/${packed?.id ?? ""}/label`,
          { headers: admin.headers }
        )
      )
      await poll(4)
      const [arrived] = await fulfillmentsOf(orderId)

      expect(shipped.data).toMatchObject({ carrier: "yurtici" })
      // As Yurtiçi's document asks: ten digits, il and ilçe apart, desi and kg apart
      expect(sent).toMatchObject({
        account: "main",
        receiverName: "Ayşe Yılmaz",
        phone: "5320000000",
        city: "İstanbul",
        town: "Kadıköy",
        codAmount: "",
      })
      expect(sent?.desi).toMatch(/^\d+\.\d{3}$/)
      expect(String(packed?.data["shipment_id"])).toMatch(/^QT[A-Z2-9]{14}$/)
      expect(packed?.data).toMatchObject({
        shipment_id: sent?.cargoKey,
        test: true,
        label_base64: null,
      })
      expect(packed?.data["label_file_id"]).toEqual(expect.stringMatching(/\.pdf$/))
      expect(label.status).toBe(200)
      expect(arrived?.shipped_at).toBeTruthy()
      expect(arrived?.delivered_at).toBeTruthy()
    })

    it("sends desi and kg only for a product measured, leaving the rest to the branch (adr/0054)", async () => {
      const ship = async () => {
        const orderId = await order()
        const shipped = await post(`/admin/orders/${orderId}/ship`, { notify: false })
        const [packed] = await fulfillmentsOf(orderId)
        return {
          status: shipped.status,
          sent: fake.shipments.get(String(packed?.data["shipment_id"])),
        }
      }
      const createBody = (index: number) =>
        fake.requests.filter((request) => request.operation === "createShipment")[index]?.body ?? ""

      const measured = await ship()
      variantId = await geliverProduct(getContainer(), shop, false)
      const unmeasured = await ship()

      // 35 × 8 × 4 cm: 0.4 desi by volume, 0.45 kg apart
      expect(measured).toMatchObject({ status: 200, sent: { desi: "0.400", kg: "0.450" } })
      // Optional in Yurtiçi's document: no made-up value, the elements left out
      expect(unmeasured).toMatchObject({ status: 200, sent: { desi: "", kg: "" } })
      expect(createBody(1)).not.toMatch(/<(desi|kg)[\s/>]/)
    })

    it("packs nothing when Yurtiçi refuses the parcel", async () => {
      const orderId = await order()
      fake.queue("createShipment", "60017")

      const refused = await post(`/admin/orders/${orderId}/ship`, { notify: false })

      expect(refused.status).toBeGreaterThanOrEqual(400)
      expect(fake.shipments.size).toBe(0)
      expect(await fulfillmentsOf(orderId)).toHaveLength(0)
    })

    it("tells the shop which part of the receiver Yurtiçi would refuse, before asking it", async () => {
      const orderId = await order({ ...PAYTR_ADDRESS, first_name: "Ab", last_name: "C" })

      const refused = await post(`/admin/orders/${orderId}/ship`, { notify: false })

      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ message: "shipping.receiver_name_short" })
      expect(fake.requests.filter(({ operation }) => operation === "createShipment")).toHaveLength(
        0
      )
      expect(await fulfillmentsOf(orderId)).toHaveLength(0)
    })

    it("ships an address without il and ilçe, which Yurtiçi's document leaves optional", async () => {
      const orderId = await order({
        first_name: PAYTR_ADDRESS.first_name,
        last_name: PAYTR_ADDRESS.last_name,
        phone: PAYTR_ADDRESS.phone,
        address_1: "Atatürk Cad. No: 1 Kadıköy",
      })

      const shipped = await post(`/admin/orders/${orderId}/ship`, { notify: false })
      const body = fake.requests.find(({ operation }) => operation === "createShipment")?.body ?? ""

      expect(shipped.status).toBe(200)
      expect(body).not.toMatch(/<(cityName|townName)[\s/>]/)
      expect(await fulfillmentsOf(orderId)).toHaveLength(1)
    })

    it("dials a phone typed oddly, and takes one from the billing address when the delivery has none", async () => {
      const odd = await order({ ...PAYTR_ADDRESS, phone: "0090 (532) 000-00-00" })
      const bare = await order()
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["shipping_address.id"], filters: { id: bare } })
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrderAddresses({
          id: (data[0] as { shipping_address: { id: string } }).shipping_address.id,
          phone: null,
        })

      const first = await post(`/admin/orders/${odd}/ship`, { notify: false })
      const second = await post(`/admin/orders/${bare}/ship`, { notify: false })
      const phones = [...fake.shipments.values()].map((sent) => sent.phone)

      expect([first.status, second.status]).toEqual([200, 200])
      // Ten digits, as Yurtiçi's document asks; the second from the billing address
      expect(phones).toEqual(["5320000000", "5320000000"])
    })

    it("keeps the parcel once its document is issued: Yurtiçi takes a cancel as a return", async () => {
      const orderId = await order()
      await post(`/admin/orders/${orderId}/ship`, { notify: false })
      const [packed] = await fulfillmentsOf(orderId)
      const sent = fake.shipments.get(String(packed?.data["shipment_id"]))
      // On its way (IND), before our next read has seen it
      if (sent) {
        sent.step = 1
      }

      const canceled = await post(
        `/admin/orders/${orderId}/fulfillments/${packed?.id ?? ""}/cancel`,
        {}
      )

      expect(canceled.status).toBeGreaterThanOrEqual(400)
      expect(sent).toMatchObject({ canceled: false, returnRequested: true })
      expect(await fulfillmentsOf(orderId)).toHaveLength(1)
    })

    it("withdraws a parcel whose answer never came, and packs nothing", async () => {
      const orderId = await order()
      fake.queue("createShipment", "lost")

      const failed = await post(`/admin/orders/${orderId}/ship`, { notify: false })
      const [opened] = [...fake.shipments.values()]

      expect(failed.status).toBeGreaterThanOrEqual(400)
      expect(opened?.canceled).toBe(true)
      expect(await fulfillmentsOf(orderId)).toHaveLength(0)
    })

    it("withdraws nothing when Yurtiçi refuses the parcel with a fault (HTTP 500)", async () => {
      const orderId = await order()
      fake.requests.length = 0
      fake.queue("createShipment", "fault:82516")

      const failed = await post(`/admin/orders/${orderId}/ship`, { notify: false })

      expect(failed.status).toBeGreaterThanOrEqual(400)
      expect(fake.requests.map((request) => request.operation)).toEqual(["createShipment"])
      expect(await fulfillmentsOf(orderId)).toHaveLength(0)
    })

    it("sends a parcel paid at the door on the door account, and asks for it when missing", async () => {
      const placed = await codOrder()

      const missing = await post(`/admin/orders/${placed.id}/ship`, { notify: false })
      await connect({ ...fake.accounts.main, ...doorSecrets(fake) })
      const shipped = await post(`/admin/orders/${placed.id}/ship`, { notify: false })
      const [sent] = [...fake.shipments.values()]
      await poll(1)
      const [packed] = await fulfillmentsOf(placed.id)

      expect(missing.data).toMatchObject({ message: "yurtici.cod_account_missing" })
      expect(shipped.status).toBe(200)
      expect(sent?.account).toBe("cod")
      expect(Number(sent?.codAmount)).toBe(placed.total)
      // Tracked through the door account: the main one does not know the parcel
      expect(packed?.shipped_at).toBeTruthy()
    })
  },
})

const doorSecrets = (fake: FakeYurtici) => ({
  cod_username: fake.accounts.cod.username,
  cod_password: fake.accounts.cod.password,
})
