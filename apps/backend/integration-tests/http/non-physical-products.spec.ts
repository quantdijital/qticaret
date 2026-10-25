import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SYSTEM_PAYMENT_PROVIDER_ID } from "../../src/scripts/bootstrap/constants"
import { seedDemo } from "../../src/scripts/seed"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { createStorefront } from "../helpers/storefront"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface ProductRow {
  id: string
  shipping_profile?: { id: string } | null
  variants?: { id: string; inventory_items?: { inventory?: { requires_shipping: boolean } }[] }[]
}

async function product(container: MedusaContainer, id: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "shipping_profile.id",
      "variants.id",
      "variants.inventory_items.inventory.requires_shipping",
    ],
    filters: { id },
  })
  return data[0] as ProductRow
}

const requiresShipping = (row: ProductRow) =>
  (row.variants ?? []).flatMap((variant) =>
    (variant.inventory_items ?? []).map((item) => item.inventory?.requires_shipping)
  )

/** F3.2: digital and service products need no shipping, behind a flag. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let demo: { regionId: string; salesChannelId: string }
    let productId: string

    const setKind = (kind: string, id = productId) =>
      settle(http.post(`/admin/products/${id}/catalog`, { kind }, { headers: admin.headers }))
    const setFlag = (enabled: boolean) =>
      http.post("/admin/features/catalog.non_physical", { enabled }, { headers: admin.headers })

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      demo = await seedDemo(container)
      const { data } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product", fields: ["id"], filters: { handle: "seramik-kupa" } })
      productId = (data[0] as { id: string }).id
    })

    it("refuses a digital kind while the flag is off", async () => {
      const refused = await setKind("digital")

      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ message: "catalog.kind_disabled" })
      expect((await product(getContainer(), productId)).shipping_profile?.id).toBeTruthy()
    })

    it("takes a digital product off shipping and puts it back", async () => {
      await setFlag(true)
      const container = getContainer()

      expect((await setKind("digital")).status).toBe(200)
      const digital = await product(container, productId)
      expect(digital.shipping_profile ?? null).toBeNull()
      expect(requiresShipping(digital).every((value) => value === false)).toBe(true)

      expect((await setKind("physical")).status).toBe(200)
      const physical = await product(container, productId)
      expect(physical.shipping_profile?.id).toBeTruthy()
      expect(requiresShipping(physical).every((value) => value === true)).toBe(true)
    })

    it("exempts a digital product from the measurement rule and keeps new variants off shipping", async () => {
      await setFlag(true)
      const { data } = await http.post<{ product: { id: string } }>(
        "/admin/products",
        {
          title: "E-kitap: Bıçak Bakımı",
          status: "draft",
          options: [{ title: "Biçim", values: ["PDF", "EPUB"] }],
          variants: [
            {
              title: "PDF",
              options: { Biçim: "PDF" },
              prices: [{ currency_code: "try", amount: 50 }],
            },
          ],
        },
        { headers: admin.headers }
      )
      const id = data.product.id
      const publish = () =>
        settle(
          http.post(`/admin/products/${id}`, { status: "published" }, { headers: admin.headers })
        )

      expect((await publish()).status).toBe(400)
      expect((await setKind("digital", id)).status).toBe(200)
      expect((await publish()).status).toBe(200)

      // Turned physical while published, it needs its measurements: refused, still digital
      const back = await setKind("physical", id)
      expect(back.status).toBe(400)
      expect(back.data).toMatchObject({ message: "catalog.dimensions_required" })
      const { data: catalog } = await http.get<{ kind: string }>(`/admin/products/${id}/catalog`, {
        headers: admin.headers,
      })
      expect(catalog.kind).toBe("digital")

      // A variant added later gets an item that needs no shipping either
      await http.post(
        `/admin/products/${id}/variants`,
        {
          title: "EPUB",
          options: { Biçim: "EPUB" },
          prices: [{ currency_code: "try", amount: 50 }],
        },
        { headers: admin.headers }
      )
      const items = requiresShipping(await product(getContainer(), id))
      expect(items).toHaveLength(2)
      expect(items.every((value) => value === false)).toBe(true)
    })

    it("checks out a digital cart without shipping, and never charges shipping on one", async () => {
      await setFlag(true)
      await setKind("digital")
      const container = getContainer()
      const variantId = (await product(container, productId)).variants?.[0]?.id ?? ""

      const orderId = await placeOrder(container, {
        ...demo,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
      const state = await http.get<{ stage: string; ship: unknown }>(
        `/admin/order-board/${orderId}`,
        {
          headers: admin.headers,
        }
      )
      // Paid (held by the system provider) and nothing to send
      expect(state.data).toMatchObject({ stage: "delivered", ship: null })

      // Through the Store API, as a shop's checkout does: a method left on a
      // cart with nothing to ship is refused, not charged
      const store = await createStorefront(container)
      const send = <T>(path: string, body: object) =>
        settle(http.post<T>(path, body, { headers: store.headers }))
      const { data: options } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "shipping_option", fields: ["id"] })
      const created = await send<{ cart: { id: string } }>("/store/carts", {
        region_id: demo.regionId,
        shipping_address: { country_code: "tr" },
        items: [{ variant_id: variantId, quantity: 1 }],
      })
      const cartId = created.data.cart.id
      await send(`/store/carts/${cartId}/shipping-methods`, {
        option_id: (options[0] as { id: string }).id,
      })
      const collection = await send<{ payment_collection: { id: string } }>(
        "/store/payment-collections",
        {
          cart_id: cartId,
        }
      )
      await send(
        `/store/payment-collections/${collection.data.payment_collection.id}/payment-sessions`,
        {
          provider_id: SYSTEM_PAYMENT_PROVIDER_ID,
        }
      )
      const completed = await send<{ message?: string }>(`/store/carts/${cartId}/complete`, {})

      expect(completed.status).toBe(400)
      expect(completed.data.message).toBe("cart.shipping_not_needed")
    })
  },
})
