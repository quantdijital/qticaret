import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedDemo } from "../../src/scripts/seed"
import { DEMO_SHIPPING_OPTIONS } from "../../src/scripts/seed/data"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import type { DemoStage } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface Board {
  orders: { id: string; display_id: number; stage: string; customer: { name: string | null } }[]
  count: number
  counts: Record<string, number>
  limited: boolean
}

interface State {
  stage: string
  ship: { fulfillment_id: string | null; items: { id: string; quantity: number }[] } | null
  deliver: string[]
  cancelable: boolean
}

async function firstId(container: MedusaContainer, entity: string, filters = {}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields: ["id"], filters })
  return (data[0] as { id: string } | undefined)?.id ?? ""
}

/** The panel's order list by stage (adr/0022): tabs, search, people only, reads recorded. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const get = <T = Board>(url: string) => settle(http.get<T>(url, { headers: admin.headers }))

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("refuses an unknown stage, unknown parameters and anonymous requests", async () => {
      const bad = await get("/admin/order-board?stage=lost")
      const extra = await get("/admin/order-board?limit=5000")
      const anonymous = await settle(http.get("/admin/order-board"))

      expect(bad.status).toBe(400)
      expect(extra.status).toBe(400)
      expect(anonymous.status).toBe(401)
    })

    it("ships an order in one step, a packed parcel first, and says what is next", async () => {
      const container = getContainer()
      const { regionId, salesChannelId } = await seedDemo(container)
      const option = await firstId(container, "shipping_option", {
        name: DEMO_SHIPPING_OPTIONS[0].name,
      })
      const variants = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["id"],
      })
      const [first, second] = variants.data as { id: string }[]
      const orderId = await placeOrder(container, {
        regionId,
        salesChannelId,
        shippingOptionId: option,
        items: [
          { variant_id: first?.id ?? "", quantity: 1 },
          { variant_id: second?.id ?? "", quantity: 2 },
        ],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
      await advanceOrder(container, orderId, "to_ship")
      const state = () => get<State>(`/admin/order-board/${orderId}`)
      const ship = () =>
        settle(
          http.post(`/admin/orders/${orderId}/ship`, { notify: false }, { headers: admin.headers })
        )

      const before = await state()
      expect(before.data).toMatchObject({ stage: "to_ship", cancelable: true })
      expect(before.data.ship?.items).toHaveLength(2)

      // A parcel packed elsewhere (or a half-done shipment) is handed over first
      const [line] = before.data.ship?.items ?? []
      await http.post(
        `/admin/orders/${orderId}/fulfillments`,
        { items: [line], no_notification: true },
        { headers: admin.headers }
      )
      const packed = await state()
      expect(packed.data.ship?.fulfillment_id).toBeTruthy()
      expect(packed.data.cancelable).toBe(false)

      expect((await ship()).status).toBe(200)
      const half = await state()
      expect(half.data.stage).toBe("to_ship")
      expect(half.data.ship).toMatchObject({ fulfillment_id: null, items: [{ quantity: 2 }] })

      expect((await ship()).status).toBe(200)
      const after = await state()
      expect(after.data).toMatchObject({ stage: "shipped", ship: null })
      expect(after.data.deliver).toHaveLength(2)

      const again = await ship()
      const anonymous = await settle(http.post(`/admin/orders/${orderId}/ship`, {}))
      const extra = await settle(
        http.post(`/admin/orders/${orderId}/ship`, { items: [] }, { headers: admin.headers })
      )
      expect(again.status).toBe(400)
      expect(anonymous.status).toBe(401)
      expect(extra.status).toBe(400)
    })

    it("sorts orders into stages, searches them and records the read", async () => {
      const container = getContainer()
      const { regionId, salesChannelId } = await seedDemo(container)
      const option = await firstId(container, "shipping_option", {
        name: DEMO_SHIPPING_OPTIONS[0].name,
      })
      const variant = await firstId(container, "product_variant")
      const place = async (stage: DemoStage, lastName: string) => {
        const orderId = await placeOrder(container, {
          regionId,
          salesChannelId,
          shippingOptionId: option,
          items: [{ variant_id: variant, quantity: 1 }],
          address: { first_name: "Ayşe", last_name: lastName, address_1: "Demo Sokak 1" },
        })
        await advanceOrder(container, orderId, stage)
      }
      await place("to_ship", "Yılmaz")
      await place("to_ship", "Demir")
      await place("shipped", "Kaya")
      await place("canceled", "Şahin")

      const all = await get("/admin/order-board")
      const toShip = await get("/admin/order-board?stage=to_ship")
      const search = await get("/admin/order-board?q=Kaya")

      expect(all.status).toBe(200)
      expect(all.data.counts).toMatchObject({ all: 4, to_ship: 2, shipped: 1, canceled: 1 })
      expect(all.data.limited).toBe(false)
      // Newest first
      expect(all.data.orders[0]?.customer.name).toBe("Ayşe Şahin")
      expect(toShip.data.count).toBe(2)
      expect(toShip.data.orders.every((order) => order.stage === "to_ship")).toBe(true)
      expect(search.data.orders.map((order) => order.customer.name)).toEqual(["Ayşe Kaya"])

      let recorded = 0
      for (let attempt = 0; attempt < 30 && recorded === 0; attempt++) {
        const { data } = await http.get<{ audit_entries: { resource_id: string | null }[] }>(
          "/admin/audit-log?kind=sensitive_read&resource_type=order",
          { headers: admin.headers }
        )
        recorded = data.audit_entries.length
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(recorded).toBeGreaterThan(0)
    })

    it("filters by where the money and the parcel stand, and marks the shop's own deliveries delivered at once (F12.3)", async () => {
      const container = getContainer()
      const { regionId, salesChannelId } = await seedDemo(container)
      const option = await firstId(container, "shipping_option", {
        name: DEMO_SHIPPING_OPTIONS[0].name,
      })
      const variant = await firstId(container, "product_variant")
      const place = async (stage: DemoStage, lastName: string) => {
        const orderId = await placeOrder(container, {
          regionId,
          salesChannelId,
          shippingOptionId: option,
          items: [{ variant_id: variant, quantity: 1 }],
          address: { first_name: "Elif", last_name: lastName, address_1: "Demo Sokak 2" },
        })
        await advanceOrder(container, orderId, stage)
        return orderId
      }
      const toShip = await place("to_ship", "Yıldız")
      const onTheWay = await place("shipped", "Aydın")
      const done = await place("delivered", "Koç")

      const paid = await get("/admin/order-board?payment=paid")
      const waiting = await get("/admin/order-board?payment=awaiting")
      const notSent = await get("/admin/order-board?shipping=none")
      const going = await get("/admin/order-board?shipping=on_the_way")
      const unknown = await get("/admin/order-board?shipping=lost")
      const deliver = (orderIds: string[], headers = admin.headers) =>
        settle(
          http.post<{
            results: { order_id: string; ok: boolean; delivered: number; error: string | null }[]
          }>("/admin/order-board/deliver", { order_ids: orderIds }, { headers })
        )
      const ops = await createAdminUser(http, container, "readonly")
      const byReadonly = await deliver([onTheWay], ops.headers)
      const marked = await deliver([onTheWay, toShip])
      const delivered = await get("/admin/order-board?shipping=delivered")

      expect(paid.data.count).toBe(3)
      expect(waiting.data.count).toBe(0)
      expect(notSent.data.orders.map((order) => order.id)).toEqual([toShip])
      expect(going.data.orders.map((order) => order.id)).toEqual([onTheWay])
      // The tabs count what the filters leave
      expect(going.data.counts).toMatchObject({ all: 1, shipped: 1, to_ship: 0 })
      expect(unknown.status).toBe(400)
      expect(byReadonly.status).toBe(403)
      expect(marked.data.results).toEqual([
        { order_id: onTheWay, ok: true, delivered: 1, error: null, message: null },
        expect.objectContaining({
          order_id: toShip,
          ok: false,
          error: "orders.nothing_to_deliver",
        }),
      ])
      expect(delivered.data.orders.map((order) => order.id).sort()).toEqual([onTheWay, done].sort())
    })
  },
})
