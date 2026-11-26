import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
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

interface NoteAnswer {
  order_note?: string | null
  message?: string
}

/** Batch 8 / O1: the shopper's order note goes from the cart to the order, cleaned and capped. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let variantId: string

    const send = (cartId: string, body: unknown, headers = storefront.headers) =>
      settle(http.post<NoteAnswer>(`/store/carts/${cartId}/order-note`, body, { headers }))
    const metadataOf = async (entity: "order" | "cart", id: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity, fields: ["metadata"], filters: { id } })
      return (data[0] as { metadata?: Record<string, unknown> | null } | undefined)?.metadata
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      variantId = (await stockedProduct(container, shop, `bicak-${String(Date.now())}`, 10, 150))
        .variantId
    })

    it("keeps the cleaned note on the cart and the order takes it", async () => {
      let cartId = ""
      let first: Awaited<ReturnType<typeof send>> | undefined
      let tooLong: Awaited<ReturnType<typeof send>> | undefined
      let reserved: Awaited<ReturnType<typeof settle>> | undefined
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        beforeComplete: async (id) => {
          cartId = id
          first = await send(id, {
            note: "  Hediye paketi\u0000 olsun\r\n\r\n\r\n\u202eLütfen\t zili çalın  ",
          })
          // Over 500 characters once cleaned: refused, the first note stays
          tooLong = await send(id, { note: "a".repeat(501) })
          // Medusa's own cart update cannot write the server's key
          reserved = await settle(
            http.post(
              `/store/carts/${id}`,
              { metadata: { qt_order_note: "sahte" } },
              { headers: storefront.headers }
            )
          )
        },
      })

      expect(first?.status).toBe(200)
      expect(first?.data.order_note).toBe("Hediye paketi olsun\n\nLütfen  zili çalın")
      expect(tooLong?.status).toBe(400)
      expect(tooLong?.data.message).toBe("checkout.order_note_too_long")
      expect(reserved?.status).toBe(400)
      expect((await metadataOf("order", orderId))?.["qt_order_note"]).toBe(
        "Hediye paketi olsun\n\nLütfen  zili çalın"
      )

      // A completed cart takes no note
      const late = await send(cartId, { note: "geç kaldı" })
      expect(late.status).toBe(404)

      // Staff read it on the packing slip
      const admin = await createAdminUser(http, getContainer())
      const slips = await settle(
        http.get<{ orders: { customer_note: string | null }[] }>(
          `/admin/packing-slips?ids=${orderId}`,
          { headers: admin.headers }
        )
      )
      expect(slips.data.orders[0]?.customer_note).toBe("Hediye paketi olsun\n\nLütfen  zili çalın")
    })

    it("takes an empty note off, refuses unknown fields and another storefront's key", async () => {
      let cleared: Record<string, unknown> | null | undefined
      let extra: Awaited<ReturnType<typeof send>> | undefined
      let keyless: Awaited<ReturnType<typeof send>> | undefined
      await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        beforeComplete: async (id) => {
          await send(id, { note: "Kapıya bırakın" })
          await send(id, { note: "   " })
          cleared = await metadataOf("cart", id)
          extra = await send(id, { note: "x", total: 0 })
          keyless = await send(id, { note: "x" }, {} as Storefront["headers"])
        },
      })

      expect(cleared?.["qt_order_note"]).toBeUndefined()
      expect(extra?.status).toBe(400)
      expect(keyless?.status).toBe(400)
    })
  },
})
