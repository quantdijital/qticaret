import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  addShippingMethodToCartWorkflow,
  createCartWorkflow,
  createShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface FulfillmentRow {
  id: string
  shipped_at: string | null
  data: Record<string, unknown>
}

/** F7 K2–K3 (adr/0031): a parcel priced by Geliver, shipped with its label kept privately. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeGeliver
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }
    let optionId: string
    let variantId: string

    /** A product of 450 g in a 35 × 8 × 4 cm box (1 desi), or one with no measures. */
    const product = async (measured = true) => {
      const { variantId: id } = await stockedProduct(
        getContainer(),
        shop,
        `bicak-${String(Date.now())}-${String(Math.random()).slice(2, 6)}`,
        10,
        120
      )
      if (measured) {
        await getContainer()
          .resolve(Modules.PRODUCT)
          .updateProductVariants(id, { weight: 450, length: 35, width: 8, height: 4 })
      }
      return id
    }
    const order = (variant = variantId) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: optionId,
        items: [{ variant_id: variant, quantity: 1 }],
        address: PAYTR_ADDRESS,
      })
    const ship = (orderId: string) =>
      settle(
        http.post<{ order_id: string; carrier: string | null; message?: string }>(
          `/admin/orders/${orderId}/ship`,
          { notify: false },
          { headers: admin.headers }
        )
      )
    const fulfillmentsOf = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: [
            "fulfillments.id",
            "fulfillments.shipped_at",
            "fulfillments.data",
            "fulfillments.canceled_at",
          ],
          filters: { id: orderId },
        })
      return (
        (data[0] as { fulfillments?: (FulfillmentRow & { canceled_at: unknown })[] })
          .fulfillments ?? []
      ).filter((each) => !each.canceled_at)
    }

    beforeAll(async () => {
      fake = await startFakeGeliver()
      process.env["GELIVER_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["GELIVER_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await http.post(
        "/admin/integrations/credentials/geliver",
        { settings: { test_mode: true }, secrets: { api_token: fake.token } },
        { headers: admin.headers }
      )
      await http.post(
        "/admin/platform-settings/store",
        { contact_email: "magaza@example.com" },
        { headers: admin.headers }
      )
      await ensureLocationCarriers(container)
      const { data: options } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "shipping_option",
        fields: ["service_zone_id"],
        filters: { id: shop.shippingOptionId },
      })
      const { result } = await createShippingOptionsWorkflow(container).run({
        input: [
          {
            name: "Geliver",
            price_type: "calculated",
            provider_id: "geliver_geliver",
            service_zone_id: (options[0] as { service_zone_id: string }).service_zone_id,
            shipping_profile_id: shop.shippingProfileId,
            data: { id: "geliver-cheapest" },
            type: { label: "Geliver", description: "Geliver", code: "geliver" },
            rules: [
              { attribute: "enabled_in_store", operator: "eq", value: "true" },
              { attribute: "is_return", operator: "eq", value: "false" },
            ],
          },
        ],
      })
      optionId = result[0]?.id ?? ""
      variantId = await product()
      fake.requests.length = 0
      fake.shipments.clear()
      fake.addresses.clear()
    })

    it("prices the cart's parcel from Geliver's list, and says when a product has no measures", async () => {
      const cartOf = async (variant: string) =>
        (
          await createCartWorkflow(getContainer()).run({
            input: {
              region_id: shop.regionId,
              sales_channel_id: shop.salesChannelId,
              currency_code: "try",
              items: [{ variant_id: variant, quantity: 1 }],
              shipping_address: PAYTR_ADDRESS,
            },
          })
        ).result.id
      const calculate = async (cartId: string) =>
        settle(
          http.post<{ shipping_option: { amount: number }; message?: string }>(
            `/store/shipping-options/${optionId}/calculate`,
            { cart_id: cartId, data: {} },
            { headers: storefront.headers }
          )
        )

      const priced = await calculate(await cartOf(variantId))
      const unmeasured = await calculate(await cartOf(await product(false)))

      // 1 desi: MNG 50 + 10 against Yurtiçi 60 + 8; the cheapest
      expect(priced.data.shipping_option.amount).toBe(60)
      expect(unmeasured.status).toBe(400)
      expect(unmeasured.data.message).toBe("shipping.dimensions_missing")
    })

    it("ships with the cheapest offer, keeps the label privately and waits for the pickup", async () => {
      const orderId = await order()

      const shipped = await ship(orderId)
      const again = await ship(orderId)
      const [fulfillment] = await fulfillmentsOf(orderId)
      const { data: state } = await http.get<{ ship: unknown; pickup: string[] }>(
        `/admin/order-board/${orderId}`,
        { headers: admin.headers }
      )
      const [shipment] = [...fake.shipments.values()]
      const label = await settle(
        http.get<{ url: string }>(
          `/admin/orders/${orderId}/fulfillments/${fulfillment?.id ?? ""}/label`,
          {
            headers: admin.headers,
          }
        )
      )
      const anonymous = await settle(
        http.get(`/admin/orders/${orderId}/fulfillments/${fulfillment?.id ?? ""}/label`)
      )

      expect(shipped.data).toMatchObject({ order_id: orderId, carrier: "geliver" })
      // Packed with its label, the parcel waits for the carrier: nothing is offered for shipping
      expect(again.data.message).toBe("orders.nothing_to_ship")
      expect(state).toMatchObject({ ship: null, pickup: [fulfillment?.id] })
      expect(shipment?.test).toBe(true)
      expect(shipment?.request).toMatchObject({
        recipientAddress: { cityCode: "34", districtName: "Kadıköy", cityName: "İstanbul" },
        order: { totalAmount: "0.00" },
      })
      expect(shipment?.request).not.toHaveProperty("productPaymentOnDelivery")
      expect(fake.addresses.get(String(shipment?.request["senderAddressID"]))).toMatchObject({
        shortName: `qt-${shop.locationId}`,
        cityCode: "34",
      })
      expect(fulfillment?.shipped_at).toBeNull()
      expect(fulfillment?.data).toMatchObject({
        shipment_id: shipment?.id,
        service_code: "MNG_STANDART",
        test: true,
        label_file_id: expect.any(String) as unknown,
      })
      expect(fulfillment?.data["label_source"] ?? null).toBeNull()
      expect(label.status).toBe(200)
      expect(label.data.url).toEqual(expect.any(String))
      expect(anonymous.status).toBe(401)
    })

    it("uses the warehouse's sender address again, and collects at the door for cash on delivery", async () => {
      await http.post(
        "/admin/features/payments.cash_on_delivery",
        { enabled: true },
        { headers: admin.headers }
      )
      await http.post(
        "/admin/platform-settings/cash_on_delivery",
        { fee_type: "none", fee_value: 0, max_amount: 0, shipping_option_ids: [optionId] },
        { headers: admin.headers }
      )
      const { result: cart } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: shop.salesChannelId,
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
      await ship(await order())

      await ship(placed.data.order.id)
      const shipments = [...fake.shipments.values()]

      expect(new Set(shipments.map((each) => each.request["senderAddressID"])).size).toBe(1)
      expect(fake.addresses.size).toBe(1)
      // 120 TL and 60 TL shipping, collected by the courier
      expect(shipments[1]?.request).toMatchObject({
        productPaymentOnDelivery: true,
        order: { totalAmount: "180.00", totalAmountCurrency: "TRY" },
      })
    })

    it("opens no Geliver shipment from Medusa's own route", async () => {
      const orderId = await order()
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
      const items = (data[0] as { items: { id: string }[] }).items

      const medusas = await settle(
        http.post(
          `/admin/orders/${orderId}/fulfillments`,
          { items: items.map(({ id }) => ({ id, quantity: 1 })) },
          { headers: admin.headers }
        )
      )

      expect(medusas.status).toBe(400)
      expect(JSON.stringify(medusas.data)).toMatch(/shipping\.use_ship_route/)
      expect(fake.shipments.size).toBe(0)
    })

    it("withdraws the shipment when the label cannot be bought, and leaves the order unpacked", async () => {
      const orderId = await order()
      fake.queue("POST /transactions", {
        status: 400,
        body: { result: false, code: "LOW_BALANCE" },
      })

      const refused = await ship(orderId)
      const [shipment] = [...fake.shipments.values()]

      expect(refused.status).toBeGreaterThanOrEqual(400)
      expect(shipment?.statusCode).toBe("CANCELED")
      expect(await fulfillmentsOf(orderId)).toHaveLength(0)
    })
  },
})
