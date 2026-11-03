import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import {
  priceSetsOfLists,
  priceSetsOfPrices,
  variantsOfPriceSets,
} from "../pricing/priced-variants"
import { variantsOfItem } from "../stock/stock-alerts"

/**
 * Which products an event changes for search (adr/0056). Events carry
 * ids only: a variant's, a price's, a stock level's, a category's are
 * followed to their products; a category or brand renamed or removed
 * touches the products the index lists under it. `all` for what every
 * product's row holds (a region's prices).
 */

const READ_DELETED = { withDeleted: true } as const
const PRICING_PREFIX = "pricing."

/** Products of these variants, a deleted variant's too. */
export async function productsOfVariants(
  container: MedusaContainer,
  variantIds: string[]
): Promise<string[]> {
  if (variantIds.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["product_id"],
    filters: { id: [...new Set(variantIds)] },
    ...READ_DELETED,
  })
  return [
    ...new Set(
      (data as { product_id?: string | null }[]).flatMap((row) =>
        row.product_id ? [row.product_id] : []
      )
    ),
  ]
}

/** The products a category holds now; none for a category gone. */
async function productsOfCategory(container: MedusaContainer, id: string): Promise<string[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["products.id"],
    filters: { id },
  })
  const category = data[0] as { products?: ({ id: string } | null)[] | null } | undefined
  return (category?.products ?? []).flatMap((product) => (product ? [product.id] : []))
}

async function inventoryItemOf(container: MedusaContainer, name: string, id: string) {
  const inventory = container.resolve(Modules.INVENTORY)
  const config = { take: 1, withDeleted: true, select: ["inventory_item_id"] }
  const [row] = name.startsWith("inventory-level.")
    ? await inventory.listInventoryLevels({ id }, config)
    : await inventory.listReservationItems({ id }, config)
  return row?.inventory_item_id ?? null
}

async function priceListOfRule(container: MedusaContainer, id: string): Promise<string | null> {
  const [rule] = await container
    .resolve(Modules.PRICING)
    .listPriceListRules({ id: [id] }, { select: ["price_list_id"], take: 1, withDeleted: true })
  // Selected as the column; the DTO names only the relation
  return (rule as { price_list_id?: string | null } | undefined)?.price_list_id ?? null
}

async function priceSetsOf(container: MedusaContainer, name: string, id: string) {
  if (name.startsWith("price.")) {
    return priceSetsOfPrices(container, [id])
  }
  const listId = name.startsWith("price-list-rule.") ? await priceListOfRule(container, id) : id
  return listId ? priceSetsOfLists(container, [listId]) : []
}

/** The products an event names or touches; `all` when every row is touched. */
export async function productsOfEvent(
  container: MedusaContainer,
  name: string,
  id: string
): Promise<string[] | "all"> {
  const index = container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
  // The pricing module's events are named under it: `pricing.price.updated`
  const subject = name.startsWith(PRICING_PREFIX) ? name.slice(PRICING_PREFIX.length) : name
  const [kind = ""] = subject.split(".")
  switch (kind) {
    case "product":
    case "catalog":
      return [id]
    case "product-variant":
      return productsOfVariants(container, [id])
    case "product-category":
      // Those the index lists under it (renamed, hidden, removed) and those it holds now (added)
      return [
        ...new Set([
          ...(await index.documentsOf({ category_id: id })),
          ...(await productsOfCategory(container, id)),
        ]),
      ]
    case "brand":
      return index.documentsOf({ brand_id: id })
    case "price":
    case "price-list":
    case "price-list-rule":
      return productsOfVariants(
        container,
        await variantsOfPriceSets(container, await priceSetsOf(container, subject, id))
      )
    case "inventory-level":
    case "reservation-item": {
      const item = await inventoryItemOf(container, name, id)
      return item ? productsOfVariants(container, await variantsOfItem(container, item)) : []
    }
    case "region":
      return "all"
    default:
      return []
  }
}
