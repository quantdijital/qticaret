import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import { createInventoryLevelsWorkflow, createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { deriveProductMediaWorkflow } from "../../workflows/media/workflows"
import { TRY_CURRENCY_CODE } from "../bootstrap/constants"
import { uploadDemoImage } from "./images"
import type { DemoCatalogProduct } from "./schema"

export interface ShopContext {
  catalogName: string
  imageDir: string
  salesChannelId: string
  shippingProfileId: string
  stockLocationId: string
  categoryIds: Map<string, string>
  vatTypeIds: Map<string, string>
}

const required = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) {
    throw new Error(`demo-catalog: ${what} is missing`)
  }
  return value
}

/** The variant's SKU, as the demo seed writes one: the handle and its option values. */
export const skuOf = (product: DemoCatalogProduct, values: readonly string[]): string =>
  [product.handle, ...values]
    .join("-")
    .toLocaleUpperCase("tr")
    .normalize("NFD")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const valuesOf = (product: DemoCatalogProduct, variant: DemoCatalogProduct["variants"][number]) =>
  product.options.map((option) =>
    required(variant.options[option.title], `${product.handle}: a variant's "${option.title}"`)
  )

/**
 * Makes one product as the panel would: its pictures uploaded first (one
 * file each), then Medusa's own create (published, priced in TRY, in the
 * shop's sales channel and default shipping profile, so the catalog's
 * hooks claim its address), then its pictures' versions.
 */
export async function createDemoProduct(
  container: MedusaContainer,
  product: DemoCatalogProduct,
  shop: ShopContext
): Promise<string> {
  const urls: string[] = []
  for (const [index, file] of product.images.entries()) {
    const name = `${product.handle}-${String(index + 1)}`
    urls.push((await uploadDemoImage(container, { dir: shop.imageDir, file }, name, false)).url)
  }
  const typeId = product.vat_type
    ? required(shop.vatTypeIds.get(product.vat_type), `VAT type ${product.vat_type}`)
    : undefined
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: product.title,
          handle: product.handle,
          description: product.description,
          status: ProductStatus.PUBLISHED,
          metadata: { demo: true, demo_catalog: shop.catalogName },
          ...product.dimensions,
          shipping_profile_id: shop.shippingProfileId,
          category_ids: product.categories.map((category) =>
            required(shop.categoryIds.get(category), `category ${category}`)
          ),
          ...(typeId ? { type_id: typeId } : {}),
          options: product.options,
          variants: product.variants.map((variant) => {
            const values = valuesOf(product, variant)
            return {
              title: values.join(" / "),
              sku: skuOf(product, values),
              options: variant.options,
              manage_inventory: true,
              prices: [{ currency_code: TRY_CURRENCY_CODE, amount: variant.price }],
            }
          }),
          images: urls.map((url) => ({ url })),
          ...(urls[0] ? { thumbnail: urls[0] } : {}),
          sales_channels: [{ id: shop.salesChannelId }],
        },
      ],
    },
  })
  const id = required(result[0]?.id, `product ${product.handle}`)
  // The subscriber does this after a save too; here it is done before the run ends
  await deriveProductMediaWorkflow(container).run({ input: { product_id: id } })
  return id
}

interface VariantRow {
  id: string
  sku: string | null
  inventory_items?:
    | ({
        inventory_item_id?: string | null
        inventory?: { location_levels?: ({ location_id?: string } | null)[] | null } | null
      } | null)[]
    | null
}

/** The product's variants by SKU. Also read on reruns: a sale price needs them. */
export async function variantsBySku(
  container: MedusaContainer,
  handle: string
): Promise<Map<string, VariantRow>> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: [
      "id",
      "sku",
      "inventory_items.inventory_item_id",
      "inventory_items.inventory.location_levels.location_id",
    ],
    filters: { product: { handle } },
  })
  return new Map((data as unknown as VariantRow[]).map((row) => [row.sku ?? "", row]))
}

/** Stock at the shop's warehouse for the variants that have no level there (0 is sold out). */
export async function stockDemoProduct(
  container: MedusaContainer,
  product: DemoCatalogProduct,
  stockLocationId: string
): Promise<void> {
  const variants = await variantsBySku(container, product.handle)
  const levels = product.variants.flatMap((variant) =>
    (variants.get(skuOf(product, valuesOf(product, variant)))?.inventory_items ?? [])
      .filter(
        (item) =>
          !item?.inventory?.location_levels?.some((level) => level?.location_id === stockLocationId)
      )
      .flatMap((item) =>
        item?.inventory_item_id
          ? [
              {
                inventory_item_id: item.inventory_item_id,
                location_id: stockLocationId,
                stocked_quantity: variant.stock,
              },
            ]
          : []
      )
  )
  if (levels.length > 0) {
    await createInventoryLevelsWorkflow(container).run({ input: { inventory_levels: levels } })
  }
}

/** Each variant's sale price by variant id, for the file's sale price list. */
export async function salePricesOf(
  container: MedusaContainer,
  product: DemoCatalogProduct
): Promise<{ variant_id: string; amount: number }[]> {
  if (!product.variants.some((variant) => variant.sale_price !== undefined)) {
    return []
  }
  const variants = await variantsBySku(container, product.handle)
  return product.variants.flatMap((variant) => {
    const id = variants.get(skuOf(product, valuesOf(product, variant)))?.id
    return id && variant.sale_price !== undefined
      ? [{ variant_id: id, amount: variant.sale_price }]
      : []
  })
}
