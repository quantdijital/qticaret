import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { TRY_CURRENCY_CODE } from "../bootstrap/constants"
import type { DemoProduct } from "./data"
import { DEMO_CATEGORIES, DEMO_PRODUCTS, DEMO_STOCKED_QUANTITY } from "./data"

export interface CatalogContext {
  salesChannelId: string
  shippingProfileId: string
  stockLocationId: string
}

/** Creates the demo categories and products that do not exist yet, with stock. */
export async function ensureDemoCatalog(
  container: MedusaContainer,
  context: CatalogContext
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const categoryIds = await ensureCategories(container)
  const productTypeIds = await vatProductTypeIds(container)

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["handle"],
    filters: { handle: DEMO_PRODUCTS.map((product) => product.handle) },
  })
  const existingHandles = new Set(existing.map((product) => product.handle))
  const missing = DEMO_PRODUCTS.filter((product) => !existingHandles.has(product.handle))
  if (missing.length === 0) {
    logger.info("seed: demo products exist, keeping them")
    return
  }

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: missing.map((product) =>
        toProductInput(product, { ...context, categoryIds, productTypeIds })
      ),
    },
  })
  await stockVariants(
    container,
    result.flatMap((product) => product.variants.map((variant) => variant.id)),
    context.stockLocationId
  )
  logger.info(`seed: created ${String(result.length)} demo products`)
}

function toProductInput(
  product: DemoProduct,
  context: CatalogContext & {
    categoryIds: Map<string, string>
    productTypeIds: Map<string, string>
  }
) {
  const categoryId = context.categoryIds.get(product.category)
  const typeId = product.vatProductType
    ? context.productTypeIds.get(product.vatProductType)
    : undefined
  if (!categoryId || (product.vatProductType && !typeId)) {
    throw new Error(`seed: category or VAT type missing for ${product.handle}; run bootstrap`)
  }
  return {
    title: product.title,
    handle: product.handle,
    description: product.description,
    status: ProductStatus.PUBLISHED,
    shipping_profile_id: context.shippingProfileId,
    category_ids: [categoryId],
    ...(typeId ? { type_id: typeId } : {}),
    options: [{ title: product.option.title, values: product.option.values }],
    variants: product.option.values.map((value) => ({
      title: value,
      sku: `${product.handle}-${value}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
      options: { [product.option.title]: value },
      manage_inventory: true,
      prices: [{ currency_code: TRY_CURRENCY_CODE, amount: product.price }],
    })),
    sales_channels: [{ id: context.salesChannelId }],
  }
}

async function ensureCategories(container: MedusaContainer): Promise<Map<string, string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
    filters: { handle: DEMO_CATEGORIES.map((category) => category.handle) },
  })
  const ids = new Map(data.map((category) => [category.handle, category.id]))

  const missing = DEMO_CATEGORIES.filter((category) => !ids.has(category.handle))
  if (missing.length > 0) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missing.map((category) => ({
          name: category.name,
          handle: category.handle,
          is_active: true,
        })),
      },
    })
    for (const category of result) {
      ids.set(category.handle, category.id)
    }
  }
  return ids
}

async function vatProductTypeIds(container: MedusaContainer): Promise<Map<string, string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product_type", fields: ["id", "value"] })
  return new Map(data.map((type) => [type.value, type.id]))
}

async function stockVariants(
  container: MedusaContainer,
  variantIds: string[],
  stockLocationId: string
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["inventory_items.inventory_item_id"],
    filters: { id: variantIds },
  })
  const inventoryItemIds = variants.flatMap((variant) =>
    (variant.inventory_items ?? [])
      .map((item) => item?.inventory_item_id)
      .filter((id): id is string => !!id)
  )
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItemIds.map((inventoryItemId) => ({
        inventory_item_id: inventoryItemId,
        location_id: stockLocationId,
        stocked_quantity: DEMO_STOCKED_QUANTITY,
      })),
    },
  })
}
