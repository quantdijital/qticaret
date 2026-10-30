import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { SHIPMENT_TRACKING_MODULE } from "../../src/modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../src/modules/shipment-tracking/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface Found {
  orders: { id: string; display_id: number; name: string | null }[]
  customers: { id: string; name: string | null; email: string }[]
  products: { id: string; title: string; sku: string | null }[]
  parcels: { order_id: string; display_id: number | null; tracking_number: string }[]
}

/** F12.9: the panel's search box finds orders, customers, products and parcels. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("finds an order by number first, a customer and order by e-mail, a product by SKU, a parcel by tracking number", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const product = await stockedProduct(container, shop, "arama-kupa", 10, 150)
      await container
        .resolve(Modules.PRODUCT)
        .updateProductVariants(product.variantId, { sku: "KUPA-MAVI-01" })
      const place = (email: string) =>
        placeOrder(container, {
          regionId: shop.regionId,
          salesChannelId: shop.salesChannelId,
          shippingOptionId: shop.shippingOptionId,
          items: [{ variant_id: product.variantId, quantity: 1 }],
          address: PAYTR_ADDRESS,
          email,
        })
      const first = await place("zeynep.arama@example.com")
      await place("baska@example.com")
      const { data } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["id", "display_id"], filters: { id: first } })
      const displayId = Number((data[0] as { display_id?: unknown }).display_id)
      await container
        .resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
        .createTrackedShipments({
          fulfillment_id: "ful_arama",
          order_id: first,
          provider: "aras",
          provider_shipment_id: "aras_arama",
          tracking_number: "AR123456789TR",
        })
      const readonly = await createAdminUser(http, container, "readonly")
      const search = async (q: string) =>
        (
          await http.get<Found>(`/admin/global-search?q=${encodeURIComponent(q)}`, {
            headers: readonly.headers,
          })
        ).data

      const byNumber = await search(`#${String(displayId)}`)
      expect(byNumber.orders[0]).toMatchObject({ id: first, display_id: displayId })

      const byEmail = await search("zeynep.arama")
      expect(byEmail.customers).toEqual([
        expect.objectContaining({ email: "zeynep.arama@example.com" }),
      ])
      expect(byEmail.orders.map((order) => order.id)).toEqual([first])

      const bySku = await search("kupa-mavi")
      expect(bySku.products).toEqual([
        { id: product.productId, title: "arama-kupa", sku: "KUPA-MAVI-01" },
      ])

      const byTracking = await search("ar123456789tr")
      expect(byTracking.parcels).toEqual([
        expect.objectContaining({ order_id: first, display_id: displayId }),
      ])

      const nothing = await search("bulunmayan-sey")
      expect(nothing).toEqual({ orders: [], customers: [], products: [], parcels: [] })

      // Too short to mean anything, and nothing but the words
      const short = await settle(
        http.get("/admin/global-search?q=a", { headers: readonly.headers })
      )
      expect(short.status).toBe(400)
      const extra = await settle(
        http.get("/admin/global-search?q=kupa&limit=50", { headers: readonly.headers })
      )
      expect(extra.status).toBe(400)

      // Customers' names: every search is a recorded read, a refused one too
      const reads = await container
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({
          actor_id: readonly.userId,
          kind: "sensitive_read",
          action: "GET /admin/global-search",
        })
      expect(reads).toHaveLength(7)
    })
  },
})
