import { readFile } from "node:fs/promises"
import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logger } from "../../lib/logging"
import { ensureBrands, ensureCategories, hideRecords } from "./categories"
import { addDemoReviews, ensureSalePrices, setDemoProductDetails } from "./details"
import { createDemoProduct, salePricesOf, stockDemoProduct } from "./products"
import type { ShopContext } from "./products"
import { demoCatalogSchema } from "./schema"

export interface DemoCatalogSummary {
  categories_created: number
  category_images: number
  brands_created: number
  products_created: number
  products_kept: number
  reviews_created: number
  sale_prices_created: number
  products_hidden: number
  categories_hidden: number
}

type Row = Record<string, unknown>

const first = (rows: readonly Row[], field: string, what: string): string => {
  const value = rows[0]?.[field]
  if (typeof value !== "string") {
    throw new Error(`demo-catalog: the shop has no ${what}; run seed:demo first`)
  }
  return value
}

/** What every product needs of the shop: read once, never made here (`seed:demo` makes it). */
async function shopOf(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [stores, profiles, locations, types] = await Promise.all([
    query.graph({ entity: "store", fields: ["default_sales_channel_id"] }),
    query.graph({ entity: "shipping_profile", fields: ["id"], filters: { type: "default" } }),
    query.graph({ entity: "stock_location", fields: ["id"] }),
    query.graph({ entity: "product_type", fields: ["id", "value"] }),
  ])
  return {
    salesChannelId: first(stores.data, "default_sales_channel_id", "default sales channel"),
    shippingProfileId: first(profiles.data, "id", "default shipping profile"),
    stockLocationId: first(locations.data, "id", "warehouse"),
    vatTypeIds: new Map(types.data.map((type) => [type.value, type.id])),
  }
}

/**
 * Loads a demo catalogue from a data file (its pictures in the `images`
 * folder beside it) into this shop: categories, brands, products with
 * pictures, stock, attributes, reviews and sale prices. Additive and safe
 * to run again: a record already here (by handle) is kept as it is, and
 * with `repair` an existing product's details are written once more (a
 * run that stopped half way).
 */
export async function loadDemoCatalog(
  container: MedusaContainer,
  file: string,
  options: { repair: boolean }
): Promise<DemoCatalogSummary> {
  const catalog = demoCatalogSchema.parse(JSON.parse(await readFile(file, "utf8")))
  const imageDir = path.join(path.dirname(file), "images")
  const hidden = await hideRecords(container, catalog.hide)
  const categories = await ensureCategories(container, catalog, imageDir)
  const brands = await ensureBrands(container, catalog)
  const shop: ShopContext = {
    ...(await shopOf(container)),
    catalogName: catalog.name,
    imageDir,
    categoryIds: categories.ids,
  }
  const details = { catalogName: catalog.name, categoryIds: categories.ids, brandIds: brands.ids }

  const { data: existing } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: catalog.products.map((product) => product.handle) },
  })
  const known = new Map(existing.map((product) => [product.handle, product.id]))
  const summary: DemoCatalogSummary = {
    categories_created: categories.created,
    category_images: categories.images,
    brands_created: brands.created,
    products_created: 0,
    products_kept: 0,
    reviews_created: 0,
    sale_prices_created: 0,
    products_hidden: hidden.products,
    categories_hidden: hidden.categories,
  }
  const sales: { variant_id: string; amount: number }[] = []
  for (const product of catalog.products) {
    let id = known.get(product.handle)
    const fresh = !id
    id ??= await createDemoProduct(container, product, shop)
    summary[fresh ? "products_created" : "products_kept"] += 1
    await stockDemoProduct(container, product, shop.stockLocationId)
    if (fresh || options.repair) {
      await setDemoProductDetails(container, id, product, details)
    }
    summary.reviews_created += await addDemoReviews(container, id, product, catalog.name)
    sales.push(...(await salePricesOf(container, product)))
    logger.info(
      { event: "demo_catalog.product", handle: product.handle, created: fresh },
      "demo catalogue product"
    )
  }
  if (catalog.sale) {
    summary.sale_prices_created = await ensureSalePrices(container, catalog.sale, sales)
  }
  logger.info({ event: "demo_catalog.loaded", ...summary }, "demo catalogue loaded")
  return summary
}
