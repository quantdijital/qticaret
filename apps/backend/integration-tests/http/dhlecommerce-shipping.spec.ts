import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { addShippingMethodToCartWorkflow, createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeDhlEcom } from "@qticaret/testing"
import type { FakeDhlEcom } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import type { PlaceOrderInput } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { measuredProduct } from "../helpers/carrier"
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
const ENV = ["DHL_ECOMMERCE_BASE_URL", "DHL_ECOMMERCE_CLIENT_ID", "DHL_ECOMMERCE_CLIENT_SECRET"]

interface FulfillmentRow {
  id: string
  shipped_at: Date | null
  delivered_at: Date | null
  canceled_at: Date | null
  data: Record<string, unknown>
}

/**
 * DHL eCommerce (formerly MNG Kargo; docs/entegrasyonlar/dhlecommerce.md):
 * a parcel shipped on the shop's own contract with the platform's app,
 * in DHL's three steps, labelled by us, tracked, withdrawn.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeDhlEcom
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
    const connect = (account: { customerNumber: string; password: string }) =>
      post("/admin/integrations/credentials/dhlecommerce", {
        settings: { test_mode: true },
        secrets: { customer_number: account.customerNumber, password: account.password },
      })
    const order = (address: PlaceOrderInput["address"] = PAYTR_ADDRESS) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: optionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address,
        email: "ayse.yilmaz@example.com",
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
    const poll = async (times: number) => {
      for (let step = 0; step < times; step += 1) {
        clock += 30 * MINUTE
        await pollShipments(getContainer(), new Date(clock))
      }
    }
    const ship = (orderId: string) => post(`/admin/orders/${orderId}/ship`, { notify: false })

    beforeAll(async () => {
      fake = await startFakeDhlEcom()
      process.env["DHL_ECOMMERCE_BASE_URL"] = fake.url
      process.env["DHL_ECOMMERCE_CLIENT_ID"] = fake.app.clientId
      process.env["DHL_ECOMMERCE_CLIENT_SECRET"] = fake.app.clientSecret
    })

    afterAll(async () => {
      for (const name of ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await ensureLocationCarriers(container)
      await connect({ ...fake.account })
      const created = await post<{ id: string }>("/admin/shipping-setup/options", {
        name: "DHL eCommerce",
        carrier: "dhlecommerce",
        pricing: { type: "flat", amount: 59.9 },
      })
      optionId = created.data.id
      variantId = await measuredProduct(container, shop)
      fake.orders.clear()
      fake.requests.length = 0
    })

    it("refuses a password DHL does not take, and lists the option as DHL eCommerce's", async () => {
      const wrong = await connect({ ...fake.account, password: "yanlis-sifre" })
      const { data } = await http.get<{ options: { id: string; carrier: string }[] }>(
        "/admin/shipping-setup/options",
        { headers: admin.headers }
      )

      expect(wrong.data).toMatchObject({ message: "dhlecommerce.secret_invalid" })
      expect(data.options.find(({ id }) => id === optionId)).toMatchObject({
        carrier: "dhlecommerce",
      })
    })

    it("says so and saves nothing on a server without the platform's app", async () => {
      const kept = ENV.map((name) => [name, process.env[name]] as const)
      for (const name of ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      try {
        const listed = await http.get<{ unavailable: string[] }>(
          "/admin/integrations/credentials",
          { headers: admin.headers }
        )
        const refused = await connect({ ...fake.account })

        expect(listed.data.unavailable).toContain("dhlecommerce")
        expect(refused.status).toBe(400)
        expect(refused.data).toMatchObject({ message: "dhlecommerce.unavailable" })
      } finally {
        for (const [name, value] of kept) {
          process.env[name] = value
        }
      }
    })

    it("ships in three steps, keeps our PDF and DHL's Zebra label privately, and follows the parcel to delivered", async () => {
      const orderId = await order()

      const shipped = await ship(orderId)
      const [packed] = await fulfillmentsOf(orderId)
      const [sent] = [...fake.orders.values()]
      const label = await settle(
        http.get<{ url: string }>(
          `/admin/orders/${orderId}/fulfillments/${packed?.id ?? ""}/label`,
          { headers: admin.headers }
        )
      )
      await poll(5)
      const [arrived] = await fulfillmentsOf(orderId)

      expect(shipped.data).toMatchObject({ carrier: "dhlecommerce" })
      expect(fake.requests.map(({ path }) => path.split("/").at(-1))).toEqual(
        expect.arrayContaining(["createRecipient", "createOrder", "createbarcode"])
      )
      // As DHL takes it: ten-digit mobile, DHL's place codes, the anonymous TCKN, the order's e-mail
      expect(sent).toMatchObject({
        recipientName: "Ayşe Yılmaz",
        phone: "5320000000",
        taxNumber: "11111111111",
        taxOffice: "SAHIS",
        isCOD: 0,
      })
      expect(sent?.email).toMatch(/@/)
      expect(sent?.cityCode).toBe(34)
      expect(String(packed?.data["shipment_id"])).toMatch(/^QT[A-Z2-9]{14}$/)
      expect(packed?.data).toMatchObject({
        shipment_id: sent?.referenceId,
        dhl_shipment_id: sent?.shipmentId,
        test: true,
        label_base64: null,
        label_zpl: null,
      })
      expect(packed?.data["label_file_id"]).toEqual(expect.stringMatching(/\.pdf$/))
      expect(packed?.data["label_zpl_file_id"]).toEqual(expect.stringMatching(/\.zpl$/))
      expect(JSON.stringify(packed?.data)).not.toContain(fake.account.password)
      expect(JSON.stringify(packed?.data)).not.toContain(fake.app.clientSecret)
      expect(label.status).toBe(200)
      expect(arrived?.shipped_at).toBeTruthy()
      expect(arrived?.delivered_at).toBeTruthy()
    })

    it("withdraws the parcel when DHL still has no branch for it (20001), telling staff to try again", async () => {
      const orderId = await order()
      for (let attempt = 0; attempt < 3; attempt += 1) {
        fake.queue("createbarcode", "20001")
      }

      const pending = await ship(orderId)
      const [opened] = [...fake.orders.values()]
      const again = await ship(orderId)

      expect(pending.status).toBe(400)
      expect(pending.data).toMatchObject({ message: "dhlecommerce.branch_pending" })
      expect(opened?.canceled).toBe(true)
      expect(again.status).toBe(200)
      expect(await fulfillmentsOf(orderId)).toHaveLength(1)
    })

    it("withdraws an order whose answer never came, and packs nothing", async () => {
      const orderId = await order()
      fake.queue("createOrder", "lost")

      const failed = await ship(orderId)
      const [opened] = [...fake.orders.values()]

      expect(failed.status).toBeGreaterThanOrEqual(400)
      expect(opened?.canceled).toBe(true)
      expect(await fulfillmentsOf(orderId)).toHaveLength(0)
    })

    it("refuses an ilçe DHL does not list before asking DHL anything", async () => {
      // A real ilçe of the test address data the fake DHL does not list (Şanlıurfa: Merkez only)
      const orderId = await order({
        first_name: PAYTR_ADDRESS.first_name,
        last_name: PAYTR_ADDRESS.last_name,
        phone: PAYTR_ADDRESS.phone,
        address_1: PAYTR_ADDRESS.address_1,
        province: "Şanlıurfa",
        city: "Haliliye",
      })

      const refused = await ship(orderId)

      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ message: "dhlecommerce.place_unknown" })
      expect(fake.orders.size).toBe(0)
    })

    it("asks for a new token once DHL refuses the kept one", async () => {
      await ship(await order())
      fake.expireTokens()
      const tokens = () => fake.requests.filter(({ path }) => path.endsWith("/token")).length
      const before = tokens()

      const second = await ship(await order())

      expect(second.status).toBe(200)
      expect(tokens()).toBe(before + 1)
    })

    it("withdraws barcode and order on cancel; keeps the parcel once the branch has it", async () => {
      const first = await order()
      await ship(first)
      const [packed] = await fulfillmentsOf(first)
      const canceled = await post(
        `/admin/orders/${first}/fulfillments/${packed?.id ?? ""}/cancel`,
        {}
      )
      const withdrawn = fake.orders.get(String(packed?.data["shipment_id"]))

      const second = await order()
      await ship(second)
      const [taken] = await fulfillmentsOf(second)
      const held = fake.orders.get(String(taken?.data["shipment_id"]))
      if (held) {
        held.step = 0
      }
      const refused = await post(
        `/admin/orders/${second}/fulfillments/${taken?.id ?? ""}/cancel`,
        {}
      )

      expect(canceled.status).toBe(200)
      expect(withdrawn).toMatchObject({ barcodeCanceled: true, canceled: true })
      expect(refused.status).toBeGreaterThanOrEqual(400)
      expect(await fulfillmentsOf(second)).toHaveLength(1)
    })

    it("collects at the door: DHL gets the amount on the order and the barcode", async () => {
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

      const shipped = await ship(placed.data.order.id)
      const [sent] = [...fake.orders.values()]
      const barcode = fake.requests.find(({ path }) => path.endsWith("/createbarcode"))

      expect(shipped.status).toBe(200)
      expect(sent).toMatchObject({ isCOD: 1, codAmount: placed.data.order.total })
      expect(barcode?.body).toMatchObject({ isCOD: 1, codAmount: placed.data.order.total })
    })
  },
})
