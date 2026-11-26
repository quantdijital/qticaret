import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { addShippingMethodToCartWorkflow, createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakePtt } from "@qticaret/testing"
import type { FakePtt } from "@qticaret/testing"
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
const RANGES = "/admin/shipping-setup/ptt-barcodes"

interface FulfillmentRow {
  id: string
  shipped_at: Date | null
  delivered_at: Date | null
  canceled_at: Date | null
  data: Record<string, unknown>
}

interface RangesView {
  ranges: { id: string; first: string; last: string; used: number; remaining: number }[]
  remaining: number
  total: number
  low: boolean
}

/**
 * PTT Kargo (docs/entegrasyonlar/ptt.md): the shop's own contract against
 * the fake PTT, each parcel under the next barcode of the shop's range,
 * labelled by us, tracked by its barcode, deleted before a branch accepts
 * it and kept after.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePtt
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
    const connect = (password = fake.account.password, customerId = fake.account.customerId) =>
      post("/admin/integrations/credentials/ptt", {
        settings: { customer_id: customerId, test_mode: false },
        secrets: { password },
      })
    const addRange = (first: string, last: string) => post<{ id: string }>(RANGES, { first, last })
    const ranges = async () => (await http.get<RangesView>(RANGES, { headers: admin.headers })).data
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
      fake = await startFakePtt()
      process.env["PTT_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["PTT_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await ensureLocationCarriers(container)
      await connect()
      const created = await post<{ id: string }>("/admin/shipping-setup/options", {
        name: "PTT Kargo",
        carrier: "ptt",
        pricing: { type: "flat", amount: 49.9 },
      })
      optionId = created.data.id
      variantId = await measuredProduct(container, shop)
      fake.shipments.clear()
      fake.requests.length = 0
    })

    it("checks the account before saving, naming the field, and lists the option as PTT's", async () => {
      const badNumber = await connect(fake.account.password, "12345")
      const wrong = await connect("yanlis-sifre")
      const right = await connect()
      const { data } = await http.get<{ options: { id: string; carrier: string }[] }>(
        "/admin/shipping-setup/options",
        { headers: admin.headers }
      )

      expect(badNumber.data).toMatchObject({ message: "ptt.customer_id_invalid" })
      expect(wrong.data).toMatchObject({ message: "ptt.secret_invalid" })
      expect(right.status).toBe(200)
      expect(data.options.find(({ id }) => id === optionId)).toMatchObject({ carrier: "ptt" })
    })

    it("keeps the shop's ranges: refuses an overlap, removes only an unused one", async () => {
      const added = await addRange("275036569000", "275036569999")
      const overlap = await addRange("275036569500", "275036570500")
      const typo = await addRange("900000000000", "900000000009")
      const removed = await settle(
        http.delete(`${RANGES}/${typo.data.id}`, { headers: admin.headers })
      )
      const view = await ranges()

      expect(added.status).toBe(200)
      expect(overlap.data).toMatchObject({ message: "ptt.barcode_range_overlaps" })
      expect(removed.status).toBe(200)
      expect(view).toMatchObject({ remaining: 1000, total: 1000, low: false })
      expect(view.ranges).toEqual([
        expect.objectContaining({ first: "275036569000", last: "275036569999", used: 0 }),
      ])
    })

    it("stops shipping without a range, and once the range is used up, never reusing a number", async () => {
      const first = await order()
      const second = await order()
      const third = await order()

      const missing = await ship(first)
      await addRange("275036569845", "275036569846")
      const one = await ship(first)
      const two = await ship(second)
      const used = await ship(third)
      const view = await ranges()
      const [opened] = await fulfillmentsOf(first)
      // Cancelled before a branch had it: its number still never comes back
      await post(`/admin/orders/${first}/fulfillments/${opened?.id ?? ""}/cancel`, {})
      const after = await ship(third)
      const inUse = await settle(
        http.delete(`${RANGES}/${view.ranges[0]?.id ?? ""}`, { headers: admin.headers })
      )

      expect(missing.data).toMatchObject({ message: "ptt.barcode_range_missing" })
      expect(one.status).toBe(200)
      expect(two.status).toBe(200)
      expect(opened?.data["shipment_id"]).toBe("2750365698456")
      expect(used.data).toMatchObject({ message: "ptt.barcode_range_exhausted" })
      expect(after.data).toMatchObject({ message: "ptt.barcode_range_exhausted" })
      expect(view).toMatchObject({ remaining: 0, total: 2, low: true })
      expect(inUse.data).toMatchObject({ message: "ptt.barcode_range_in_use" })
      expect(fake.shipments.size).toBe(2)
    })

    it("loads the parcel under its barcode, keeps our label privately, and follows it to delivered", async () => {
      await addRange("275036569000", "275036569999")
      const orderId = await order()

      const shipped = await ship(orderId)
      const [packed] = await fulfillmentsOf(orderId)
      const barcode = String(packed?.data["shipment_id"])
      const sent = fake.shipments.get(barcode)
      const upload = fake.requests.find(({ operation }) => operation === "kabulEkle2")?.body ?? ""
      const label = await settle(
        http.get<{ url: string }>(
          `/admin/orders/${orderId}/fulfillments/${packed?.id ?? ""}/label`,
          { headers: admin.headers }
        )
      )
      await poll(4)
      const [arrived] = await fulfillmentsOf(orderId)

      expect(shipped.data).toMatchObject({ carrier: "ptt" })
      expect(barcode).toMatch(/^275036569\d{4}$/)
      expect(sent).toMatchObject({
        receiverName: "Ayşe Yılmaz",
        phone: "5320000000",
        city: "İstanbul",
        town: "Kadıköy",
        grams: "450",
        services: "",
        paymentType: "MH",
        test: false,
      })
      expect(packed?.data).toMatchObject({
        file_name: sent?.fileName,
        reference: sent?.reference,
        label_base64: null,
      })
      expect(packed?.data["label_file_id"]).toEqual(expect.stringMatching(/\.pdf$/))
      // No e-mail to PTT (KVKK)
      expect(upload).not.toContain("ayse.yilmaz@example.com")
      expect(JSON.stringify(packed?.data)).not.toContain(fake.account.password)
      expect(label.status).toBe(200)
      expect(arrived?.shipped_at).toBeTruthy()
      expect(arrived?.delivered_at).toBeTruthy()
    })

    it("packs nothing when PTT refuses the parcel, showing its words", async () => {
      await addRange("275036569000", "275036569999")
      const orderId = await order()
      fake.queue("kabulEkle2", "code:-5:Ek hizmet tanımlı değil")

      const refused = await ship(orderId)

      expect(refused.status).toBeGreaterThanOrEqual(400)
      expect(refused.data).toMatchObject({
        provider: "ptt",
        provider_message: "Ek hizmet tanımlı değil",
      })
      expect(fake.shipments.size).toBe(0)
      expect(await fulfillmentsOf(orderId)).toHaveLength(0)
    })

    it("deletes the parcel before acceptance, and keeps it once a branch has it", async () => {
      await addRange("275036569000", "275036569999")
      const early = await order()
      const late = await order()
      await ship(early)
      await ship(late)
      const [earlyParcel] = await fulfillmentsOf(early)
      const [lateParcel] = await fulfillmentsOf(late)
      const accepted = fake.shipments.get(String(lateParcel?.data["shipment_id"]))
      if (accepted) {
        accepted.step = 0
      }

      const deleted = await post(
        `/admin/orders/${early}/fulfillments/${earlyParcel?.id ?? ""}/cancel`,
        {}
      )
      const kept = await post(
        `/admin/orders/${late}/fulfillments/${lateParcel?.id ?? ""}/cancel`,
        {}
      )

      expect(deleted.status).toBe(200)
      expect(fake.shipments.get(String(earlyParcel?.data["shipment_id"]))?.canceled).toBe(true)
      expect(kept.status).toBeGreaterThanOrEqual(400)
      expect(kept.data).toMatchObject({ message: "ptt.already_accepted" })
      expect(await fulfillmentsOf(late)).toHaveLength(1)
    })

    it("asks PTT to collect a parcel paid at the door (ödeme şartlı)", async () => {
      await addRange("275036569000", "275036569999")
      const placed = await codOrder()

      const shipped = await ship(placed.id)
      const [sent] = [...fake.shipments.values()]

      expect(shipped.status).toBe(200)
      expect(sent?.services).toBe("OS")
      expect(Math.round(Number(sent?.codAmount) * 100)).toBe(Math.round(placed.total * 100))
    })
  },
})
