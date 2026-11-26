import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedDemo } from "../../src/scripts/seed"
import { DEMO_PRODUCTS, DEMO_SHIPPING_OPTIONS } from "../../src/scripts/seed/data"
import type { HttpClient } from "../helpers/http"

jest.setTimeout(120 * 1000)

// docs/13 slug rules
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

interface StoreVariant {
  id: string
  calculated_price: {
    currency_code: string
    calculated_amount: number
    is_calculated_price_tax_inclusive: boolean
  }
}

interface StoreProductsResponse {
  products: { handle: string; variants: StoreVariant[] }[]
}

async function publishableKeyHeaders(container: MedusaContainer, keyId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["token"],
    filters: { id: keyId },
  })
  const token = data[0]?.token
  if (!token) {
    throw new Error("publishable key missing")
  }
  return { "x-publishable-api-key": token }
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    describe("seedDemo", () => {
      it("lists the demo products in TRY with tax-inclusive prices on the Store API", async () => {
        const container = getContainer()
        const seeded = await seedDemo(container)
        const headers = await publishableKeyHeaders(container, seeded.publishableKeyId)

        const { status, data } = await http.get<StoreProductsResponse>(
          `/store/products?region_id=${seeded.regionId}&fields=handle,*variants.calculated_price`,
          { headers }
        )

        expect(status).toBe(200)
        expect(data.products.map((product) => product.handle).sort()).toEqual(
          DEMO_PRODUCTS.map((product) => product.handle).sort()
        )
        for (const product of data.products) {
          const expected = DEMO_PRODUCTS.find((demo) => demo.handle === product.handle)
          for (const variant of product.variants) {
            expect(variant.calculated_price).toMatchObject({
              currency_code: "try",
              calculated_amount: expected?.price,
              is_calculated_price_tax_inclusive: true,
            })
          }
        }
      })

      it("is idempotent: a second run creates nothing new", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const first = await seedDemo(container)
        const second = await seedDemo(container)

        expect(second).toEqual(first)
        const count = async (entity: string) =>
          (await query.graph({ entity, fields: ["id"] })).data.length
        expect(await count("product")).toBe(DEMO_PRODUCTS.length)
        expect(await count("product_category")).toBe(3)
        expect(await count("stock_location")).toBe(1)
        expect(await count("shipping_option")).toBe(DEMO_SHIPPING_OPTIONS.length)
        expect(await count("inventory_level")).toBe(
          DEMO_PRODUCTS.reduce((sum, product) => sum + product.option.values.length, 0)
        )
      })

      it("restocks demo variants a failed earlier run left without stock", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        await seedDemo(container)
        const { data: levels } = await query.graph({ entity: "inventory_level", fields: ["id"] })
        await container
          .resolve(Modules.INVENTORY)
          .deleteInventoryLevels(levels.map((level) => level.id))

        await seedDemo(container)

        const { data: restocked } = await query.graph({
          entity: "inventory_level",
          fields: ["stocked_quantity"],
        })
        expect(restocked).toHaveLength(levels.length)
        expect(restocked.every((level) => level.stocked_quantity === 100)).toBe(true)
      })

      it("offers the TRY shipping options to a cart shipping to Turkey", async () => {
        const container = getContainer()
        const seeded = await seedDemo(container)
        const headers = await publishableKeyHeaders(container, seeded.publishableKeyId)
        const { data: products } = await http.get<StoreProductsResponse>(
          `/store/products?handle=seramik-kupa&region_id=${seeded.regionId}`,
          { headers }
        )
        const variantId = products.products[0]?.variants[0]?.id

        const { data: created } = await http.post<{ cart: { id: string } }>(
          "/store/carts",
          {
            region_id: seeded.regionId,
            shipping_address: { country_code: "tr" },
            items: [{ variant_id: variantId, quantity: 1 }],
          },
          { headers }
        )
        const { data } = await http.get<{ shipping_options: { id: string; name: string }[] }>(
          `/store/shipping-options?cart_id=${created.cart.id}`,
          { headers }
        )
        // A flat amount priced by our quote (adr/0087): asked per option, as the storefront does
        const priced = await Promise.all(
          data.shipping_options.map(async (option) => {
            const { data: one } = await http.post<{ shipping_option: { amount: number } }>(
              `/store/shipping-options/${option.id}/calculate`,
              { cart_id: created.cart.id, data: {} },
              { headers }
            )
            return { name: option.name, amount: one.shipping_option.amount }
          })
        )

        expect(priced).toEqual(
          expect.arrayContaining(
            DEMO_SHIPPING_OPTIONS.map((option) => ({ name: option.name, amount: option.price }))
          )
        )
      })

      it("marks what it creates as demo, so demo:remove takes nothing else", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        await seedDemo(container)

        for (const entity of ["product", "product_category", "shipping_option"] as const) {
          const { data } = await query.graph({ entity, fields: ["id", "metadata"] })
          const rows = data as unknown as { metadata?: Record<string, unknown> | null }[]
          expect(rows.length).toBeGreaterThan(0)
          expect(rows.every((row) => row.metadata?.["demo"] === true)).toBe(true)
        }
      })

      it("uses docs/13 compliant handles", () => {
        for (const product of DEMO_PRODUCTS) {
          expect(product.handle).toMatch(SLUG)
          expect(product.handle.length).toBeLessThanOrEqual(80)
        }
      })
    })
  },
})
