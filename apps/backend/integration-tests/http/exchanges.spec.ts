import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createInventoryLevelsWorkflow, createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { SHIPMENT_TRACKING_MODULE } from "../../src/modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../src/modules/shipment-tracking/service"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { geliverOrder, geliverShop, shipOrder } from "../helpers/geliver"
import type { GeliverShop } from "../helpers/geliver"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const MINUTE = 60 * 1000

type Size = "M" | "L" | "XL" | "S"
// A shirt whose sizes cost alike, but for a dearer XL and a cheaper S
const PRICES: Readonly<Record<Size, number>> = { M: 120, L: 120, XL: 170, S: 70 }

interface Request {
  id: string
  status: string
  kind: string
  difference: string | null
  refund_amount: string | null
  return_code: string | null
}

/** F7.11 (adr/0032 §6): a size swapped, what it costs, and the stock both ways. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeGeliver
    let setup: GeliverShop
    let customer: TestCustomer
    let sizes: Record<Size, string>
    let clock = Date.now()

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    /** The shirt in four sizes, ten of each, measured for the carrier. */
    const shirt = async (): Promise<Record<Size, string>> => {
      const handle = `gomlek-${String(Date.now())}-${String(Math.random()).slice(2, 6)}`
      const names = Object.keys(PRICES) as Size[]
      const { result } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: handle,
              handle,
              status: "published",
              shipping_profile_id: setup.shop.shippingProfileId,
              options: [{ title: "Beden", values: names }],
              variants: names.map((name) => ({
                title: name,
                options: { Beden: name },
                manage_inventory: true,
                weight: 450,
                length: 35,
                width: 8,
                height: 4,
                prices: [{ currency_code: "try", amount: PRICES[name] }],
              })),
              sales_channels: [{ id: setup.shop.salesChannelId }],
            },
          ],
        },
      })
      const variants = result[0]?.variants ?? []
      const { data } = await query().graph({
        entity: "product_variant",
        fields: ["id", "title", "inventory_items.inventory_item_id"],
        filters: { id: variants.map((variant) => variant.id) },
      })
      const rows = data as {
        id: string
        title: Size
        inventory_items: { inventory_item_id: string }[]
      }[]
      await createInventoryLevelsWorkflow(getContainer()).run({
        input: {
          inventory_levels: rows.map((row) => ({
            inventory_item_id: row.inventory_items[0]?.inventory_item_id ?? "",
            location_id: setup.shop.locationId,
            stocked_quantity: 10,
          })),
        },
      })
      return Object.fromEntries(rows.map((row) => [row.title, row.id])) as Record<Size, string>
    }
    /** A shirt of `size` the customer bought, paid, shipped with Geliver and delivered. */
    const delivered = async (size: Size) => {
      const orderId = await geliverOrder(getContainer(), setup, sizes[size])
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(orderId, { customer_id: customer.id })
      const { data } = await query().graph({
        entity: "order",
        fields: ["items.id", "payment_collections.payments.id"],
        filters: { id: orderId },
      })
      const row = data[0] as {
        items: { id: string }[]
        payment_collections: { payments: { id: string }[] }[]
      }
      const paymentId = row.payment_collections[0]?.payments[0]?.id ?? ""
      await http.post(`/admin/payments/${paymentId}/capture`, {}, { headers: setup.admin.headers })
      await shipOrder(http, setup, orderId)
      for (let step = 0; step < 4; step += 1) {
        clock += 30 * MINUTE
        await pollShipments(getContainer(), new Date(clock))
      }
      return { orderId, lineId: row.items[0]?.id ?? "" }
    }
    const swap = (orderId: string, lineId: string, size: Size) =>
      settle(
        http.post<{ return_request: Request; message?: string }>(
          `/store/orders/${orderId}/returns`,
          {
            kind: "exchange",
            items: [{ line_item_id: lineId, quantity: 1, variant_id: sizes[size] }],
            reason: "size_issue",
          },
          { headers: customer.headers }
        )
      )
    const staff = <T>(path: string, body: unknown = {}) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))
    const stockOf = async (size: Size) => {
      const { data } = await query().graph({
        entity: "product_variant",
        fields: [
          "inventory_items.inventory.location_levels.stocked_quantity",
          "inventory_items.inventory.location_levels.reserved_quantity",
        ],
        filters: { id: sizes[size] },
      })
      const level = (
        data[0] as {
          inventory_items: {
            inventory: {
              location_levels: { stocked_quantity: number; reserved_quantity: number }[]
            }
          }[]
        }
      ).inventory_items[0]?.inventory.location_levels[0]
      return { stocked: level?.stocked_quantity ?? 0, reserved: level?.reserved_quantity ?? 0 }
    }
    const listed = async (orderId: string) =>
      (
        await http.get<{ return_requests: Request[] }>(
          `/admin/return-requests?order_id=${orderId}`,
          { headers: setup.admin.headers }
        )
      ).data.return_requests[0]

    beforeAll(async () => {
      fake = await startFakeGeliver()
      process.env["GELIVER_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["GELIVER_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      setup = await geliverShop(http, getContainer(), fake)
      sizes = await shirt()
      customer = await registerCustomer(http, await createStorefront(getContainer()))
    })

    it("swaps a size at the same price: nothing owed, the old size back in stock, the new one sent", async () => {
      const { orderId, lineId } = await delivered("M")
      const before = { M: await stockOf("M"), L: await stockOf("L") }

      const asked = await swap(orderId, lineId, "L")
      const id = asked.data.return_request.id
      const approved = await staff<{ return_request: Request }>(
        `/admin/return-requests/${id}/approve`,
        { difference_collected: false }
      )
      const set = await stockOf("L")
      const early = await shipOrder(http, setup, orderId)
      await staff(`/admin/return-requests/${id}/receive`, {
        items: [{ line_item_id: lineId, quantity: 1 }],
      })
      const back = await stockOf("M")
      const sent = await shipOrder(http, setup, orderId)

      expect(asked.data.return_request).toMatchObject({ kind: "exchange", difference: "0.00" })
      expect(approved.data.return_request).toMatchObject({ status: "approved" })
      expect(approved.data.return_request.return_code).toEqual(expect.any(String))
      // The new size is set aside at approval, sent only once the old one is back
      expect(set.reserved).toBe(before.L.reserved + 1)
      expect(early.data.message).toBe("returns.exchange_awaiting_return")
      expect(back.stocked).toBe(before.M.stocked + 1)
      expect(sent.status).toBe(200)
      expect(await listed(orderId)).toMatchObject({ status: "received", refund_amount: null })
    })

    it("asks the dearer size's difference first, and gives the cheaper size's back", async () => {
      const dearer = await delivered("M")
      const cheaper = await delivered("M")

      const up = await swap(dearer.orderId, dearer.lineId, "XL")
      const unpaid = await staff(`/admin/return-requests/${up.data.return_request.id}/approve`)
      const paid = await staff<{ return_request: Request }>(
        `/admin/return-requests/${up.data.return_request.id}/approve`,
        { difference_collected: true }
      )
      const summary = async () => {
        const { data } = await query().graph({
          entity: "order",
          fields: ["summary"],
          filters: { id: dearer.orderId },
        })
        const sums = (data[0] as { summary: { paid_total: unknown; pending_difference: unknown } })
          .summary
        return { paid: Number(sums.paid_total), pending: Number(sums.pending_difference) }
      }
      const collected = await summary()
      await staff(`/admin/return-requests/${up.data.return_request.id}/receive`, {
        items: [{ line_item_id: dearer.lineId, quantity: 1 }],
      })
      const settled = await summary()
      const down = await swap(cheaper.orderId, cheaper.lineId, "S")
      const downId = down.data.return_request.id
      await staff(`/admin/return-requests/${downId}/approve`, { difference_collected: false })
      const received = await staff<{ refund_error: string | null }>(
        `/admin/return-requests/${downId}/receive`,
        { items: [{ line_item_id: cheaper.lineId, quantity: 1 }] }
      )

      expect(up.data.return_request.difference).toBe("50.00")
      expect(unpaid.data.message).toBe("returns.exchange_difference_due")
      expect(paid.data.return_request).toMatchObject({ status: "approved", difference: "50.00" })
      // Medusa's sums: the 50 TL collected is paid (120 TL shirt and 60 TL shipping before),
      // and once the M is back nothing is owed either way
      expect(collected.paid).toBe(230)
      expect(settled.pending).toBe(0)
      expect(await listed(dearer.orderId)).toMatchObject({
        status: "received",
        refund_amount: null,
      })
      expect(down.data.return_request.difference).toBe("-50.00")
      expect(received.data.refund_error).toBeNull()
      expect(await listed(cheaper.orderId)).toMatchObject({
        status: "refunded",
        refund_amount: "50.00",
      })
    })

    it("undoes Medusa's exchange when the carrier refuses the return, so it can be approved again", async () => {
      const { orderId, lineId } = await delivered("M")
      const before = await stockOf("L")
      const asked = await swap(orderId, lineId, "L")
      const id = asked.data.return_request.id
      const [parcel] = await getContainer()
        .resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
        .listTrackedShipments({ order_id: orderId })
      fake.queue(`POST /shipments/${parcel?.provider_shipment_id ?? ""}`, {
        status: 400,
        body: { result: false, code: "RETURN_NOT_ALLOWED" },
      })

      const refused = await staff(`/admin/return-requests/${id}/approve`)
      const held = await stockOf("L")
      const again = await staff<{ return_request: Request }>(`/admin/return-requests/${id}/approve`)

      expect(refused.status).toBeGreaterThanOrEqual(400)
      // Nothing set aside by the failed approval
      expect(held.reserved).toBe(before.reserved)
      expect(again.data.return_request).toMatchObject({ status: "approved" })
      expect((await stockOf("L")).reserved).toBe(before.reserved + 1)
    })

    it("refuses another product's variant, the same size, and a swap naming no size", async () => {
      const { orderId, lineId } = await delivered("M")
      const other = setup.variantId
      const foreign = await settle(
        http.post<{ message?: string }>(
          `/store/orders/${orderId}/returns`,
          {
            kind: "exchange",
            items: [{ line_item_id: lineId, quantity: 1, variant_id: other }],
            reason: "size_issue",
          },
          { headers: customer.headers }
        )
      )
      const same = await swap(orderId, lineId, "M")
      const plain = await settle(
        http.post<{ message?: string }>(
          `/store/orders/${orderId}/returns`,
          { kind: "exchange", items: [{ line_item_id: lineId, quantity: 1 }], reason: "other" },
          { headers: customer.headers }
        )
      )

      expect(foreign.data.message).toBe("returns.exchange_variant_invalid")
      expect(same.data.message).toBe("returns.exchange_same_variant")
      expect(plain.status).toBe(400)
    })
  },
})
