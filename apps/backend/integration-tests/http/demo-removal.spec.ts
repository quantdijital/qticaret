import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { removeDemo, removeOrderedDemoProducts } from "../../src/scripts/demo-removal"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { stockShop } from "../helpers/stock"

jest.setTimeout(180 * 1000)

interface ProductRow {
  id: string
  variants: { id: string; inventory_items: { inventory_item_id: string }[] }[]
}

/**
 * `demo:remove products-with-orders` (a developer's machine only): the seed
 * products a shopper's order still holds stock for go too, their
 * reservations released; the order keeps its lines as written.
 */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    it("takes the seed products a shopper's order holds only when asked, the order's lines kept", async () => {
      const container = getContainer()
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const shop = await stockShop(container)
      const productOf = async (handle: string) => {
        const { data } = await query.graph({
          entity: "product",
          fields: ["id", "variants.id", "variants.inventory_items.inventory_item_id"],
          filters: { handle },
        })
        return data[0] as ProductRow | undefined
      }
      const shirt = await productOf("pamuklu-tisort")
      const variantId = shirt?.variants[0]?.id ?? ""
      const itemId = shirt?.variants[0]?.inventory_items[0]?.inventory_item_id ?? ""
      // A shopper's order (not the seed's): it reserves the shirt's stock
      const orderId = await placeOrder(container, {
        ...shop,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Moda Cad. No: 5" },
      })
      const inventory = container.resolve(Modules.INVENTORY)
      const held = await inventory.listReservationItems({ inventory_item_id: itemId })

      const plain = await removeDemo(container)
      const keptByPlainRun = await productOf("pamuklu-tisort")
      const ordered = await removeOrderedDemoProducts(container)
      const again = await removeOrderedDemoProducts(container)
      const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "items.product_title", "items.variant_id"],
        filters: { id: orderId },
      })
      const { data: clothing } = await query.graph({
        entity: "product_category",
        fields: ["id"],
        filters: { handle: "giyim" },
      })

      expect(held).toHaveLength(1)
      // The plain run leaves a product an order holds, and its category
      expect(plain.productsKept).toContain("pamuklu-tisort")
      expect(plain.categoriesKept).toContain("giyim")
      expect(keptByPlainRun?.id).toBe(shirt?.id)
      expect(ordered).toMatchObject({ productsKept: [], reservations: 1 })
      expect(ordered.products).toContain("pamuklu-tisort")
      expect(ordered.categories).toBeGreaterThan(0)
      expect(await productOf("pamuklu-tisort")).toBeUndefined()
      expect(await inventory.listReservationItems({ inventory_item_id: itemId })).toHaveLength(0)
      expect(clothing).toHaveLength(0)
      // The order stays, its line as the shopper bought it
      expect(orders).toHaveLength(1)
      expect((orders[0] as { items: { product_title: string }[] }).items[0]?.product_title).toBe(
        "Pamuklu Tişört"
      )
      // Safe to run again: nothing left to take
      expect(again).toMatchObject({ products: [], reservations: 0, productsKept: [] })
    })
  },
})
