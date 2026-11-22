import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedDemo } from "../../src/scripts/seed"
import { BOOKING_MODULE } from "../../src/modules/booking"
import type BookingModuleService from "../../src/modules/booking/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

interface VariantRow {
  id: string
  manage_inventory: boolean
  allow_backorder: boolean
}

async function variantsOf(container: MedusaContainer, productId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "manage_inventory", "allow_backorder"],
    filters: { product_id: productId },
  })
  return data as VariantRow[]
}

const DAY = 24 * 60 * 60 * 1000

/** adr/0076 D2: the booking module's admin side, the flag and the product's booking mode. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let productId: string

    const setFlag = (key: string, enabled: boolean) =>
      http.post(`/admin/features/${key}`, { enabled }, { headers: admin.headers })
    const turnOn = async () => {
      await setFlag("catalog.non_physical", true)
      await setFlag("catalog.booking", true)
    }
    const saveCatalog = (body: Record<string, unknown>, id = productId) =>
      settle(http.post(`/admin/products/${id}/catalog`, body, { headers: admin.headers }))
    const call = (method: "get" | "post", path: string, body?: unknown, headers = admin.headers) =>
      settle(
        method === "get" ? http.get(path, { headers }) : http.post(path, body ?? {}, { headers })
      )
    const departure = (offsetDays: number, capacity: number) => ({
      starts_at: new Date(Date.now() + offsetDays * DAY).toISOString(),
      capacity,
    })

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      await seedDemo(container)
      const { data } = await http.post<{ product: { id: string } }>(
        "/admin/products",
        {
          title: "Kapadokya günübirlik",
          status: "draft",
          options: [{ title: "Kişi", values: ["Yetişkin", "Çocuk"] }],
          variants: [
            {
              title: "Yetişkin",
              options: { Kişi: "Yetişkin" },
              manage_inventory: true,
              prices: [{ currency_code: "try", amount: 1500 }],
            },
          ],
        },
        { headers: admin.headers }
      )
      productId = data.product.id
    })

    it("answers as missing while the flag is off, and leaves the product as it was (K11)", async () => {
      const before = await variantsOf(getContainer(), productId)

      for (const [method, path] of [
        ["get", `/admin/products/${productId}/bookable`],
        ["post", `/admin/products/${productId}/bookable`],
        ["get", `/admin/products/${productId}/booking-slots`],
        ["post", `/admin/products/${productId}/booking-slots`],
        ["post", "/admin/booking-slots/bkslot_01ABC"],
      ] as const) {
        expect((await call(method, path)).status).toBe(404)
      }
      const refused = await saveCatalog({ booking_mode: "departure" })
      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ message: "catalog.booking_disabled" })

      // The catalog save without a booking mode works as before and reads `none`
      expect((await saveCatalog({ condition: "used" })).status).toBe(200)
      const { data } = await http.get<{ booking_mode: string; condition: string; kind: string }>(
        `/admin/products/${productId}/catalog`,
        { headers: admin.headers }
      )
      expect(data).toMatchObject({ booking_mode: "none", condition: "used", kind: "physical" })
      expect(await variantsOf(getContainer(), productId)).toEqual(before)
    })

    it("needs both flags, a service product, and refuses the reserved range mode", async () => {
      await setFlag("catalog.booking", true)
      expect((await saveCatalog({ kind: "service", booking_mode: "departure" })).status).toBe(400)

      await setFlag("catalog.non_physical", true)
      const physical = await saveCatalog({ booking_mode: "departure" })
      const range = await saveCatalog({ kind: "service", booking_mode: "range" })

      expect(physical.data).toMatchObject({ message: "catalog.booking_kind" })
      expect(range.data).toMatchObject({ message: "catalog.booking_range_unavailable" })
    })

    it("takes a dated product's variants off stock, new ones too, and keeps its kind", async () => {
      await turnOn()

      expect((await saveCatalog({ kind: "service", booking_mode: "departure" })).status).toBe(200)
      expect(await variantsOf(getContainer(), productId)).toEqual([
        expect.objectContaining({ manage_inventory: false, allow_backorder: false }),
      ])

      const added = await call("post", `/admin/products/${productId}/variants`, {
        title: "Çocuk",
        options: { Kişi: "Çocuk" },
        manage_inventory: true,
        prices: [{ currency_code: "try", amount: 900 }],
      })
      expect(added.status).toBe(200)
      const variants = await variantsOf(getContainer(), productId)
      expect(variants).toHaveLength(2)
      expect(variants.every((variant) => !variant.manage_inventory)).toBe(true)

      // Another kind only with the mode cleared in the same save
      expect((await saveCatalog({ kind: "physical" })).data).toMatchObject({
        message: "catalog.booking_kind",
      })
      expect((await saveCatalog({ kind: "physical", booking_mode: "none" })).status).toBe(200)
    })

    it("keeps a dated product's variants off stock when the product is saved with them", async () => {
      await turnOn()
      await saveCatalog({ kind: "service", booking_mode: "departure" })
      const [variant] = await variantsOf(getContainer(), productId)

      const saved = await call("post", `/admin/products/${productId}`, {
        variants: [{ id: variant?.id, manage_inventory: true, allow_backorder: true }],
      })

      expect(saved.status).toBe(200)
      expect(await variantsOf(getContainer(), productId)).toEqual([
        expect.objectContaining({ manage_inventory: false, allow_backorder: false }),
      ])
    })

    it("keeps settings and departures, refuses a capacity below the places taken", async () => {
      await turnOn()
      const notDated = await call("post", `/admin/products/${productId}/booking-slots`, {
        slots: [departure(10, 5)],
      })
      expect(notDated.data).toMatchObject({ message: "booking.product_not_dated" })
      await saveCatalog({ kind: "service", booking_mode: "departure" })
      const [variant] = await variantsOf(getContainer(), productId)

      const settings = await call("post", `/admin/products/${productId}/bookable`, {
        hold_minutes: 15,
        cutoff_hours: 24,
        pax_by_variant: { [variant?.id ?? ""]: { pax: 1, min_age: 12 } },
      })
      expect(settings.status).toBe(200)
      expect(settings.data).toMatchObject({
        booking_mode: "departure",
        bookable: { hold_minutes: 15, cutoff_hours: 24, traveler_fields: { level: "none" } },
      })
      const badHold = await call("post", `/admin/products/${productId}/bookable`, {
        hold_minutes: 5,
      })
      expect(badHold.status).toBe(400)

      const made = await call("post", `/admin/products/${productId}/booking-slots`, {
        slots: [
          { ...departure(10, 5), price_adjustments: { [variant?.id ?? ""]: 250.5 } },
          departure(17, 8),
        ],
      })
      expect(made.status).toBe(200)
      const slots = (made.data as { slots: { id: string; available: number }[] }).slots
      expect(slots.map((slot) => slot.available)).toEqual([5, 8])
      const unknownVariant = await call("post", `/admin/products/${productId}/booking-slots`, {
        slots: [{ ...departure(3, 2), price_adjustments: { variant_nope: 10 } }],
      })
      expect(unknownVariant.data).toMatchObject({ message: "booking.variant_unknown" })

      const first = slots[0]?.id ?? ""
      await getContainer()
        .resolve<BookingModuleService>(BOOKING_MODULE)
        .holdUnits("cart_test", [{ slotId: first, units: 3 }], 20)
      const lowered = await call("post", `/admin/booking-slots/${first}`, { capacity: 2 })
      const closed = await call("post", `/admin/booking-slots/${first}`, {
        capacity: 3,
        status: "closed",
      })

      expect(lowered.status).toBe(400)
      expect(lowered.data).toMatchObject({ message: "booking.capacity_below_sold" })
      expect(closed.data).toMatchObject({
        slot: { capacity: 3, status: "closed", held: 3, available: 0 },
      })
      const listed = await call("get", `/admin/products/${productId}/booking-slots`)
      expect((listed.data as { slots: unknown[] }).slots).toHaveLength(2)
      // Counters are never taken from the request
      const sold = await call("post", `/admin/booking-slots/${first}`, { sold: 0 })
      expect(sold.status).toBe(400)
    })

    it("lets every role read and only the product editors write", async () => {
      await turnOn()
      await saveCatalog({ kind: "service", booking_mode: "departure" })
      const operations = await createAdminUser(http, getContainer(), "operations")

      const read = await call(
        "get",
        `/admin/products/${productId}/booking-slots`,
        undefined,
        operations.headers
      )
      const write = await call(
        "post",
        `/admin/products/${productId}/booking-slots`,
        { slots: [departure(5, 4)] },
        operations.headers
      )
      const settings = await call(
        "post",
        `/admin/products/${productId}/bookable`,
        { hold_minutes: 30 },
        operations.headers
      )

      expect(read.status).toBe(200)
      expect(write.status).toBe(403)
      expect(settings.status).toBe(403)
    })
  },
})
