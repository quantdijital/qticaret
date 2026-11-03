import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { removeDemo, removeOrderedDemoProducts } from "../../src/scripts/demo-removal"
import runRemoveDemo from "../../src/scripts/remove-demo"
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "../../src/scripts/seed/data"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(180 * 1000)

interface ProductRow {
  id: string
  title: string
  variants: { id: string; inventory_items: { inventory_item_id: string }[] }[]
}

const productOf = async (container: MedusaContainer, handle: string) => {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "title", "variants.id", "variants.inventory_items.inventory_item_id"],
    filters: { handle },
  })
  return data[0] as ProductRow | undefined
}

const categoryOf = async (container: MedusaContainer, handle: string) => {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id"],
    filters: { handle },
  })
  return data[0]
}

/** A shopper's order (not the seed's) for the first variant of each product: it reserves their stock. */
const orderOf = async (container: MedusaContainer, shop: StockShop, products: ProductRow[]) =>
  placeOrder(container, {
    ...shop,
    items: products.map((product) => ({ variant_id: product.variants[0]?.id ?? "", quantity: 1 })),
    address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Moda Cad. No: 5" },
  })

const firstItemOf = (product: ProductRow | undefined) =>
  product?.variants[0]?.inventory_items[0]?.inventory_item_id ?? ""

const lineTitlesOf = async (container: MedusaContainer, orderId: string) => {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "items.product_title"],
    filters: { id: orderId },
  })
  const orders = data as unknown as { items: { product_title: string }[] }[]
  return orders.flatMap((order) => order.items.map((item) => item.product_title)).sort()
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
      const shop = await stockShop(container)
      const shirt = await productOf(container, "pamuklu-tisort")
      const itemId = firstItemOf(shirt)
      const orderId = await orderOf(container, shop, shirt ? [shirt] : [])
      const inventory = container.resolve(Modules.INVENTORY)
      const held = await inventory.listReservationItems({ inventory_item_id: itemId })

      const plain = await removeDemo(container)
      const keptByPlainRun = await productOf(container, "pamuklu-tisort")
      const ordered = await removeOrderedDemoProducts(container)
      const again = await removeOrderedDemoProducts(container)

      expect(held).toHaveLength(1)
      // The plain run leaves a product an order holds, and its category
      expect(plain.productsKept).toContain("pamuklu-tisort")
      expect(plain.categoriesKept).toContain("giyim")
      expect(keptByPlainRun?.id).toBe(shirt?.id)
      expect(ordered).toMatchObject({ productsKept: [], reservations: 1 })
      expect(ordered.products).toContain("pamuklu-tisort")
      expect(ordered.categories).toBeGreaterThan(0)
      expect(await productOf(container, "pamuklu-tisort")).toBeUndefined()
      expect(await inventory.listReservationItems({ inventory_item_id: itemId })).toHaveLength(0)
      expect(await categoryOf(container, "giyim")).toBeUndefined()
      // The order stays, its line as the shopper bought it
      expect(await lineTitlesOf(container, orderId)).toEqual(["Pamuklu Tişört"])
      // Safe to run again: nothing left to take
      expect(again).toMatchObject({ products: [], reservations: 0, productsKept: [] })
    })

    it("takes them from a database seeded before the mark, as `demo:remove products-with-orders` runs", async () => {
      const container = getContainer()
      const shop = await stockShop(container)
      // Seeded before 2026-11-03: the seed's titles and names, no metadata at all
      const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      await knex("product")
        .whereIn(
          "handle",
          DEMO_PRODUCTS.map((product) => product.handle)
        )
        .update({ metadata: null })
      await knex("product_category")
        .whereIn(
          "handle",
          DEMO_CATEGORIES.map((category) => category.handle)
        )
        .update({ metadata: null })
      const shirt = await productOf(container, "pamuklu-tisort")
      const cloth = await productOf(container, "keten-masa-ortusu")
      const held = [shirt, cloth].flatMap((product) => (product ? [product] : []))
      const items = held.map(firstItemOf)
      const orderId = await orderOf(container, shop, held)
      const inventory = container.resolve(Modules.INVENTORY)
      const reserved = await inventory.listReservationItems({ inventory_item_id: items })

      // Without the option: kept as before, stock links and reservations untouched
      await runRemoveDemo({ container, args: [] })
      const keptShirt = await productOf(container, "pamuklu-tisort")
      const stillReserved = await inventory.listReservationItems({ inventory_item_id: items })
      await runRemoveDemo({ container, args: ["products-with-orders"] })
      const again = await removeOrderedDemoProducts(container)

      expect(held).toHaveLength(2)
      expect(reserved).toHaveLength(2)
      expect(keptShirt?.id).toBe(shirt?.id)
      expect(firstItemOf(keptShirt)).toBe(items[0])
      expect(stillReserved).toHaveLength(2)
      // With it: both gone, their reservations released and their stock records with them
      expect(await productOf(container, "pamuklu-tisort")).toBeUndefined()
      expect(await productOf(container, "keten-masa-ortusu")).toBeUndefined()
      expect(await inventory.listReservationItems({ inventory_item_id: items })).toHaveLength(0)
      expect(await inventory.listInventoryItems({ id: items })).toHaveLength(0)
      expect(await categoryOf(container, "giyim")).toBeUndefined()
      expect(await categoryOf(container, "ev-ve-yasam")).toBeUndefined()
      // The order stays, its lines as the shopper bought them
      expect(await lineTitlesOf(container, orderId)).toEqual(
        held.map((product) => product.title).sort()
      )
      expect(again).toMatchObject({ products: [], reservations: 0, productsKept: [] })
    })

    it("never takes a product with a demo handle the shop renamed, even with an order on it", async () => {
      const container = getContainer()
      const shop = await stockShop(container)
      const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      // No mark and a title the seed never wrote: the shop's own (or its edit)
      await knex("product")
        .where("handle", "pamuklu-tisort")
        .update({ metadata: null, title: "Pamuklu Tişört Siyah" })
      const shirt = await productOf(container, "pamuklu-tisort")
      await orderOf(container, shop, shirt ? [shirt] : [])

      await runRemoveDemo({ container, args: ["products-with-orders"] })
      const ordered = await removeOrderedDemoProducts(container)

      expect((await productOf(container, "pamuklu-tisort"))?.id).toBe(shirt?.id)
      expect(
        await container
          .resolve(Modules.INVENTORY)
          .listReservationItems({ inventory_item_id: firstItemOf(shirt) })
      ).toHaveLength(1)
      expect(ordered).toMatchObject({ products: [], reservations: 0, productsKept: [] })
    })
  },
})
