import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { geliverOrder, geliverShop } from "../helpers/geliver"
import type { GeliverShop } from "../helpers/geliver"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface ShipResult {
  order_id: string
  ok: boolean
  carrier: string | null
  fulfillment_id: string | null
  error: string | null
}

/** F7.7, F7.10: an order in several parcels, and several orders shipped at once. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeGeliver
    let setup: GeliverShop

    const post = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))

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
    })

    it("ships an order in parts, never more than is left", async () => {
      const orderId = await placeOrder(getContainer(), {
        regionId: setup.shop.regionId,
        salesChannelId: setup.shop.salesChannelId,
        shippingOptionId: setup.shop.shippingOptionId,
        items: [{ variant_id: setup.variantId, quantity: 3 }],
        address: PAYTR_ADDRESS,
      })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
      const lineId = (data[0] as { items: { id: string }[] }).items[0]?.id ?? ""
      const ship = (quantity: number) =>
        post(`/admin/orders/${orderId}/ship`, { notify: false, items: [{ id: lineId, quantity }] })

      const first = await ship(1)
      const tooMany = await ship(3)
      const rest = await ship(2)
      const { data: state } = await http.get<{ ship: unknown; stage: string }>(
        `/admin/order-board/${orderId}`,
        { headers: setup.admin.headers }
      )

      expect(first.status).toBe(200)
      expect(tooMany.data.message).toBe("orders.ship_items_invalid")
      expect(rest.status).toBe(200)
      expect(state).toMatchObject({ ship: null, stage: "shipped" })
    })

    it("ships picked orders at once, reporting each, and lists where each parcel stands", async () => {
      const first = await geliverOrder(getContainer(), setup)
      const second = await geliverOrder(getContainer(), setup)

      const { data } = await post<{ results: ShipResult[] }>("/admin/order-board/ship", {
        order_ids: [first, second, "order_01UNKNOWN0000000000000000"],
        notify: false,
      })
      const board = await http.get<{
        orders: {
          id: string
          shipping: { status: string; fulfillment_id: string } | null
          delivery: { carrier: string | null } | null
        }[]
      }>("/admin/order-board", { headers: setup.admin.headers })
      const listed = board.data.orders.filter(({ id }) => id === first || id === second)

      expect(data.results).toEqual([
        expect.objectContaining({ order_id: first, ok: true, carrier: "geliver" }),
        expect.objectContaining({ order_id: second, ok: true, carrier: "geliver" }),
        expect.objectContaining({ ok: false, error: expect.any(String) as unknown }),
      ])
      expect(data.results[0]?.fulfillment_id).toEqual(expect.any(String))
      expect(listed.map(({ shipping }) => shipping?.status)).toEqual(["created", "created"])
      // Each parcel's label prints again from the list; the option shows who carries it
      expect(listed.map(({ shipping }) => shipping?.fulfillment_id).sort()).toEqual(
        data.results
          .slice(0, 2)
          .map(({ fulfillment_id }) => fulfillment_id)
          .sort()
      )
      expect(listed.map(({ delivery }) => delivery?.carrier)).toEqual(["geliver", "geliver"])
    })
  },
})
