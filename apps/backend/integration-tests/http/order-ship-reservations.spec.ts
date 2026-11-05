import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow, updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { geliverShop } from "../helpers/geliver"
import type { GeliverShop } from "../helpers/geliver"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface FilledEntry {
  changes: {
    location_id: string
    levels: string[]
    lines: { line_item_id: string; inventory_item_id: string; kind: string; quantity: number }[]
  }
}

/**
 * adr/0054, 2026-11-05 addendum: a line whose stock was never held (an
 * order placed while its variant kept no stock, a reservation deleted or
 * cut down) still ships. "Kargoya ver" holds what is missing first, and
 * undoes it when the parcel does not go.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeGeliver
    let setup: GeliverShop

    const inventory = () => getContainer().resolve(Modules.INVENTORY)
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    /** An order of these lines, sent by the shop itself unless a carrier's option is named. */
    const order = (
      items: { variant_id: string; quantity: number }[],
      shippingOptionId = setup.shop.shippingOptionId
    ) =>
      placeOrder(getContainer(), {
        regionId: setup.shop.regionId,
        salesChannelId: setup.shop.salesChannelId,
        shippingOptionId,
        items,
        address: PAYTR_ADDRESS,
      })
    /** The order's line for each variant. */
    const linesOf = async (orderId: string) => {
      const { data } = await query().graph({
        entity: "order",
        fields: ["items.id", "items.variant_id"],
        filters: { id: orderId },
      })
      const items = (data[0] as { items: { id: string; variant_id: string }[] }).items
      return new Map(items.map((item) => [item.variant_id, item.id]))
    }
    const itemOf = async (variantId: string) => {
      const { data } = await query().graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantId },
      })
      return (data[0] as { inventory_items: { inventory_item_id: string }[] }).inventory_items[0]
        ?.inventory_item_id
    }
    const levelsOf = async (itemId: string) =>
      (await inventory().listInventoryLevels({ inventory_item_id: itemId })).map((level) => ({
        location_id: level.location_id,
        stocked: level.stocked_quantity,
        reserved: level.reserved_quantity,
      }))
    const heldFor = async (lineId: string) =>
      (await inventory().listReservationItems({ line_item_id: lineId })).map(
        (reservation) => reservation.quantity
      )
    const ship = (orderId: string) =>
      settle(
        http.post<{ carrier: string | null; message?: string }>(
          `/admin/orders/${orderId}/ship`,
          { notify: false },
          { headers: setup.admin.headers }
        )
      )
    const filledOf = async (orderId: string) =>
      (await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries(
          { action: "order.reservation_filled", resource_id: orderId },
          { select: ["changes"] }
        )) as unknown as FilledEntry[]
    /** A product whose variant keeps no stock (`manage_inventory: false`), as a service or made-to-order one may. */
    const untracked = async () => {
      const handle = `elde-${String(Date.now())}-${String(Math.random()).slice(2, 6)}`
      const { result } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: handle,
              handle,
              status: "published",
              shipping_profile_id: setup.shop.shippingProfileId,
              options: [{ title: "Seçenek", values: ["Standart"] }],
              variants: [
                {
                  title: "Standart",
                  options: { Seçenek: "Standart" },
                  manage_inventory: false,
                  prices: [{ currency_code: "try", amount: 80 }],
                },
              ],
              sales_channels: [{ id: setup.shop.salesChannelId }],
            },
          ],
        },
      })
      return result[0]?.variants[0]?.id ?? ""
    }
    /** Stock tracking turned on after the order: Medusa gives the variant an item, no level. */
    const trackFromNow = (variantId: string) =>
      updateProductVariantsWorkflow(getContainer()).run({
        input: { product_variants: [{ id: variantId, manage_inventory: true }] },
      })

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

    it("ships a line whose reservation was deleted, holding it first", async () => {
      const orderId = await order([{ variant_id: setup.variantId, quantity: 2 }])
      const lineId = (await linesOf(orderId)).get(setup.variantId) ?? ""
      const itemId = (await itemOf(setup.variantId)) ?? ""
      await inventory().deleteReservationItemsByLineItem(lineId)

      const shipped = await ship(orderId)

      expect(shipped.data.message).toBeUndefined()
      expect(shipped.status).toBe(200)
      // The two units left the shelf; nothing is held for them any more
      expect(await levelsOf(itemId)).toEqual([
        { location_id: setup.shop.locationId, stocked: 8, reserved: 0 },
      ])
      expect(await heldFor(lineId)).toEqual([])
      const [filled] = await filledOf(orderId)
      expect(filled?.changes).toMatchObject({
        location_id: setup.shop.locationId,
        levels: [],
        lines: [{ line_item_id: lineId, inventory_item_id: itemId, kind: "created", quantity: 2 }],
      })
    })

    it("raises a reservation smaller than the parcel", async () => {
      const orderId = await order([{ variant_id: setup.variantId, quantity: 3 }])
      const lineId = (await linesOf(orderId)).get(setup.variantId) ?? ""
      const itemId = (await itemOf(setup.variantId)) ?? ""
      const [held] = await inventory().listReservationItems({ line_item_id: lineId })
      await inventory().updateReservationItems({ id: held?.id ?? "", quantity: 1 })

      const shipped = await ship(orderId)

      expect(shipped.status).toBe(200)
      expect(await levelsOf(itemId)).toEqual([
        { location_id: setup.shop.locationId, stocked: 7, reserved: 0 },
      ])
      expect(await heldFor(lineId)).toEqual([])
      const [filled] = await filledOf(orderId)
      expect(filled?.changes.lines).toEqual([
        expect.objectContaining({ line_item_id: lineId, kind: "raised", quantity: 2 }),
      ])
    })

    it("leaves an untracked line alone and holds one tracked since the order", async () => {
      const loose = await untracked()
      const later = await untracked()
      const orderId = await order([
        { variant_id: loose, quantity: 1 },
        { variant_id: later, quantity: 1 },
      ])
      const lines = await linesOf(orderId)
      await trackFromNow(later)
      const laterItem = (await itemOf(later)) ?? ""

      const shipped = await ship(orderId)

      expect(shipped.data.message).toBeUndefined()
      expect(shipped.status).toBe(200)
      // The untracked variant keeps no stock at all, before and after
      expect(await itemOf(loose)).toBeUndefined()
      expect(await heldFor(lines.get(loose) ?? "")).toEqual([])
      // The parcel exists: the warehouse gets a level at 0, and the unit leaves it
      expect(await levelsOf(laterItem)).toEqual([
        { location_id: setup.shop.locationId, stocked: -1, reserved: 0 },
      ])
      const [filled] = await filledOf(orderId)
      expect(filled?.changes).toMatchObject({
        levels: [laterItem],
        lines: [{ line_item_id: lines.get(later), kind: "created", quantity: 1 }],
      })
    })

    it("undoes what it held when the carrier refuses the parcel", async () => {
      const later = await untracked()
      const orderId = await order(
        [
          { variant_id: setup.variantId, quantity: 2 },
          { variant_id: later, quantity: 1 },
        ],
        setup.optionId
      )
      const lines = await linesOf(orderId)
      const stockedId = (await itemOf(setup.variantId)) ?? ""
      const [held] = await inventory().listReservationItems({
        line_item_id: lines.get(setup.variantId) ?? "",
      })
      await inventory().updateReservationItems({ id: held?.id ?? "", quantity: 1 })
      await trackFromNow(later)
      const laterItem = (await itemOf(later)) ?? ""
      fake.queue("POST /transactions", {
        status: 400,
        body: { result: false, code: "LOW_BALANCE" },
      })

      const refused = await ship(orderId)

      expect(refused.status).toBeGreaterThanOrEqual(400)
      // The reservation is back to its own size, the made one and the made level are gone
      expect(await heldFor(lines.get(setup.variantId) ?? "")).toEqual([1])
      expect(await levelsOf(stockedId)).toEqual([
        { location_id: setup.shop.locationId, stocked: 10, reserved: 1 },
      ])
      expect(await heldFor(lines.get(later) ?? "")).toEqual([])
      expect(await levelsOf(laterItem)).toEqual([])
      expect(await filledOf(orderId)).toEqual([])

      // The next try finds things as they were and holds the same again
      const again = await ship(orderId)
      expect(again.status).toBe(200)
      const [filled] = await filledOf(orderId)
      expect(filled?.changes.levels).toEqual([laterItem])
      expect(filled?.changes.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ line_item_id: lines.get(setup.variantId), kind: "raised" }),
          expect.objectContaining({ line_item_id: lines.get(later), kind: "created" }),
        ])
      )
      expect(await levelsOf(stockedId)).toEqual([
        { location_id: setup.shop.locationId, stocked: 8, reserved: 0 },
      ])
    })
  },
})
