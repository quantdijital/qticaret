import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { SHIPMENT_TRACKING_MODULE } from "../../src/modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../src/modules/shipment-tracking/service"
import { geliverOrder, geliverShop, shipOrder } from "../helpers/geliver"
import type { GeliverShop } from "../helpers/geliver"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const MINUTE = 60 * 1000

/** F7 K4 (adr/0031): a parcel followed to the door, by notification or by the job, each move once. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeGeliver
    let setup: GeliverShop
    // The job asks a parcel again only after 25 minutes: each run is half an hour later
    let clock = Date.now()
    const poll = () => {
      clock += 30 * MINUTE
      return pollShipments(getContainer(), new Date(clock))
    }
    const notify = (id: string, body?: unknown) =>
      settle(
        http.post<{ ok: boolean }>(
          "/hooks/geliver",
          body ?? { event: "TRACK_UPDATED", data: { id } }
        )
      )
    const tracking = () =>
      getContainer().resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
    const shippedOrder = async () => {
      const orderId = await geliverOrder(getContainer(), setup)
      await shipOrder(http, setup, orderId)
      const [tracked] = await tracking().listTrackedShipments({ order_id: orderId })
      if (!tracked) {
        throw new Error(`order ${orderId} has no tracked parcel`)
      }
      return { orderId, tracked }
    }
    const orderOf = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: [
            "fulfillments.shipped_at",
            "fulfillments.delivered_at",
            "fulfillments.labels.tracking_number",
            "items.detail.shipped_quantity",
            "items.detail.delivered_quantity",
          ],
          filters: { id: orderId },
        })
      return data[0] as {
        fulfillments: {
          shipped_at: string | null
          delivered_at: string | null
          labels: { tracking_number: string }[]
        }[]
        items: { detail: { shipped_quantity: number; delivered_quantity: number } }[]
      }
    }
    const eventsOf = async (trackedId: string) =>
      (
        await tracking().listShipmentEvents(
          { shipment_id: trackedId },
          { order: { created_at: "ASC" } }
        )
      ).map((event) => event.status)

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

    it("follows a test parcel to the door: handed over at pickup, delivered with Geliver", async () => {
      const { orderId, tracked } = await shippedOrder()

      // Each read moves a test shipment on: tracking code, label printed, shipped, delivered
      await poll()
      await poll()
      const pickedUp = await poll()
      const afterPickup = await orderOf(orderId)
      const delivered = await poll()
      const after = await orderOf(orderId)
      const [row] = await tracking().listTrackedShipments({ id: tracked.id })

      expect(pickedUp).toBe(1)
      expect(afterPickup.fulfillments[0]?.shipped_at).not.toBeNull()
      expect(afterPickup.fulfillments[0]?.delivered_at).toBeNull()
      expect(delivered).toBe(1)
      expect(after.fulfillments[0]?.delivered_at).not.toBeNull()
      expect(after.fulfillments[0]?.labels[0]?.tracking_number).toBe(row?.tracking_number)
      expect(after.items[0]?.detail).toMatchObject({ shipped_quantity: 1, delivered_quantity: 1 })
      expect(row?.status).toBe("delivered")
      expect(await eventsOf(tracked.id)).toEqual(["in_transit", "delivered"])
      // A delivered parcel is asked about no more
      expect(await poll()).toBe(0)
    })

    it("records a move once, whether a notification or the job learns it, even at once", async () => {
      const { orderId, tracked } = await shippedOrder()
      // Two reads: the tracking code, the label printed; the next read finds it shipped
      fake.advance(tracked.provider_shipment_id)
      fake.advance(tracked.provider_shipment_id)
      fake.advance(tracked.provider_shipment_id)
      fake.hold(tracked.provider_shipment_id)

      const [notified] = await Promise.all([notify(tracked.provider_shipment_id), poll()])
      const again = await notify(tracked.provider_shipment_id)
      await poll()
      const order = await orderOf(orderId)

      expect(notified.status).toBe(200)
      expect(again.data).toEqual({ ok: true })
      expect(await eventsOf(tracked.id)).toEqual(["in_transit"])
      expect(order.fulfillments).toHaveLength(1)
      expect(order.items[0]?.detail.shipped_quantity).toBe(1)
    })

    it("asks once for notifications at once, and ends a parcel whose fulfillment was cancelled", async () => {
      const { orderId, tracked } = await shippedOrder()
      const reads = () =>
        fake.requests.filter(
          ({ method, path }) =>
            method === "GET" && path === `/shipments/${tracked.provider_shipment_id}`
        ).length
      const before = reads()

      await Promise.all([
        notify(tracked.provider_shipment_id),
        notify(tracked.provider_shipment_id),
        notify(tracked.provider_shipment_id),
      ])
      const asked = reads() - before
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["fulfillments.id"], filters: { id: orderId } })
      const fulfillmentId =
        (data[0] as { fulfillments: { id: string }[] }).fulfillments[0]?.id ?? ""
      await http.post(
        `/admin/orders/${orderId}/fulfillments/${fulfillmentId}/cancel`,
        {},
        { headers: setup.admin.headers }
      )
      await poll()
      const [ended] = await tracking().listTrackedShipments({ id: tracked.id })

      expect(asked).toBe(1)
      expect(ended?.status).toBe("canceled")
      expect(await poll()).toBe(0)
    })

    it("marks a parcel the carrier fails on as asked, so it waits its turn", async () => {
      const { tracked } = await shippedOrder()
      fake.queue(`GET /shipments/${tracked.provider_shipment_id}`, {
        status: 404,
        body: { result: false, code: "NOT_FOUND" },
      })

      await poll()
      const [row] = await tracking().listTrackedShipments({ id: tracked.id })

      expect(row?.status).toBe("created")
      expect(row?.checked_at).not.toBeNull()
    })

    it("acknowledges what is not a tracked parcel and refuses what is not a notification", async () => {
      const unknown = await notify("ffffffff-0000-4000-8000-000000000000")
      const other = await notify("", { event: "SOMETHING_ELSE", data: { id: "x" } })
      const garbled = await notify("", { hello: "world" })

      expect(unknown.data).toEqual({ ok: true })
      expect(other.data).toEqual({ ok: true })
      expect(garbled.status).toBe(400)
    })
  },
})
