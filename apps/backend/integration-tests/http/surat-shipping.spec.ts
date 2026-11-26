import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { addShippingMethodToCartWorkflow, createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeSurat } from "@qticaret/testing"
import type { FakeSurat } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import { placeOrder } from "../../src/scripts/seed/orders/place"
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

interface FulfillmentRow {
  id: string
  shipped_at: Date | null
  delivered_at: Date | null
  canceled_at: Date | null
  data: Record<string, unknown>
}

/**
 * Sürat Kargo (docs/entegrasyonlar/surat.md): a parcel shipped on the
 * shop's own contract against the fake Sürat (Sürat has no test service),
 * labelled by us when Sürat gives none, tracked by the cari pair,
 * cancelled by deleting it or, once the branch has it, by asking it back.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeSurat
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
      post("/admin/integrations/credentials/surat", { settings: {}, secrets })
    const cari = () => ({
      cari_code: fake.accounts.tracking.cariCode,
      web_password: fake.accounts.tracking.webPassword,
    })
    const order = () =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: optionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        email: "ayse.yilmaz@example.com",
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
    const ship = (orderId: string) => post(`/admin/orders/${orderId}/ship`, { notify: false })

    beforeAll(async () => {
      fake = await startFakeSurat()
      process.env["SURAT_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["SURAT_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await ensureLocationCarriers(container)
      await connect({ ...fake.accounts.shipping, ...cari() })
      const created = await post<{ id: string }>("/admin/shipping-setup/options", {
        name: "Sürat Kargo",
        carrier: "surat",
        pricing: { type: "flat", amount: 59.9 },
      })
      optionId = created.data.id
      variantId = await measuredProduct(container, shop)
      fake.shipments.clear()
      fake.requests.length = 0
    })

    it("checks the tracking login before saving, naming the field, and lists the option as Sürat's", async () => {
      const wrongCari = await connect({
        ...fake.accounts.shipping,
        cari_code: fake.accounts.tracking.cariCode,
        web_password: "yanlis-sifre",
      })
      const halfCari = await connect({ cari_code: fake.accounts.tracking.cariCode })
      // One pair only: the shipping login tracks too, and is checked so
      await settle(http.delete("/admin/integrations/credentials/surat", { headers: admin.headers }))
      const wrongMain = await connect({ ...fake.accounts.shipping, password: "yanlis-sifre" })
      const onePair = await connect({ ...fake.accounts.shipping })
      const { data } = await http.get<{ options: { id: string; carrier: string }[] }>(
        "/admin/shipping-setup/options",
        { headers: admin.headers }
      )

      expect(wrongCari.data).toMatchObject({ message: "surat.merchant_invalid" })
      expect(halfCari.data).toMatchObject({ message: "integration_credentials.secrets_required" })
      expect(wrongMain.data).toMatchObject({ message: "surat.secret_invalid" })
      expect(onePair.status).toBe(200)
      expect(data.options.find(({ id }) => id === optionId)).toMatchObject({ carrier: "surat" })
    })

    it("ships under our code, keeps our label privately, and follows the parcel to delivered", async () => {
      const orderId = await order()

      const shipped = await post<{ carrier: string }>(`/admin/orders/${orderId}/ship`, {
        notify: false,
      })
      const [packed] = await fulfillmentsOf(orderId)
      const [sent] = [...fake.shipments.values()]
      const createBody =
        fake.requests.find(({ operation }) => operation === "GonderiyiKargoyaGonderYeni")?.body ??
        ""
      const label = await settle(
        http.get<{ url: string }>(
          `/admin/orders/${orderId}/fulfillments/${packed?.id ?? ""}/label`,
          { headers: admin.headers }
        )
      )
      await poll(4)
      const [arrived] = await fulfillmentsOf(orderId)

      expect(shipped.data).toMatchObject({ carrier: "surat" })
      expect(sent).toMatchObject({
        receiverName: "Ayşe Yılmaz",
        phone: "5320000000",
        city: "İstanbul",
        town: "Kadıköy",
        collectionType: "0",
        desi: "0.38",
        kg: "0.45",
      })
      // No e-mail to Sürat (KVKK): the field goes empty
      expect(createBody).not.toContain("ayse.yilmaz@example.com")
      // Sürat gave no label (no barcode permission): ours, asked for first
      expect(fake.requests.map(({ operation }) => operation)).toContain("KargoBarkodu")
      expect(String(packed?.data["shipment_id"])).toMatch(/^QT[A-Z2-9]{14}$/)
      expect(packed?.data).toMatchObject({ shipment_id: sent?.code, label_base64: null })
      expect(packed?.data["label_file_id"]).toEqual(expect.stringMatching(/\.pdf$/))
      expect(label.status).toBe(200)
      expect(arrived?.shipped_at).toBeTruthy()
      expect(arrived?.delivered_at).toBeTruthy()
    })

    it("packs nothing when Sürat refuses the parcel, showing its words", async () => {
      const orderId = await order()
      fake.queue("GonderiyiKargoyaGonderYeni", "say:Alıcı ilçesi tanımsız")

      const refused = await ship(orderId)

      expect(refused.status).toBeGreaterThanOrEqual(400)
      expect(refused.data).toMatchObject({
        provider: "surat",
        provider_message: "Alıcı ilçesi tanımsız",
      })
      expect(fake.shipments.size).toBe(0)
      expect(await fulfillmentsOf(orderId)).toHaveLength(0)
    })

    it("deletes a parcel whose answer never came, and packs nothing", async () => {
      const orderId = await order()
      fake.queue("GonderiyiKargoyaGonderYeni", "lost")

      const failed = await ship(orderId)
      const [opened] = [...fake.shipments.values()]

      expect(failed.status).toBeGreaterThanOrEqual(400)
      expect(opened?.canceled).toBe(true)
      expect(await fulfillmentsOf(orderId)).toHaveLength(0)
    })

    it("asks Sürat for the parcel back once the branch has it, and keeps the fulfillment", async () => {
      const orderId = await order()
      await ship(orderId)
      const [packed] = await fulfillmentsOf(orderId)
      // The branch took it, before our next read has seen it
      const sent = fake.shipments.get(String(packed?.data["shipment_id"]))
      if (sent) {
        sent.step = 0
      }

      const canceled = await post(
        `/admin/orders/${orderId}/fulfillments/${packed?.id ?? ""}/cancel`,
        {}
      )
      await poll(1)
      const [kept] = await fulfillmentsOf(orderId)

      expect(canceled.status).toBeGreaterThanOrEqual(400)
      expect(canceled.data).toMatchObject({ message: "surat.withdraw_requested" })
      expect(sent).toMatchObject({ canceled: false, withdrawn: true })
      expect(kept?.id).toBe(packed?.id)
    })

    it("asks the courier to collect a parcel paid at the door, on the same account", async () => {
      const placed = await codOrder()

      const shipped = await ship(placed.id)
      const [sent] = [...fake.shipments.values()]

      expect(shipped.status).toBe(200)
      expect(sent?.collectionType).toBe("1")
      expect(Number(sent?.codAmount)).toBe(placed.total)
    })
  },
})
