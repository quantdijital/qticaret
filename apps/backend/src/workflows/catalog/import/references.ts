import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { chunksOf } from "../../../lib/catalog"
import type { SheetProduct, SheetUnits } from "../../../lib/catalog-sheet"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { StoreSettings } from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import type {
  AttributeOption,
  DefinitionShape,
} from "../../../modules/product-attributes/validation"
import { existingProducts } from "./existing-products"
import type { ExistingProduct } from "./existing-products"

/**
 * What the sheet's products refer to, read once per import (F3.9): the
 * categories, collections, brands and templates it names by handle, the
 * products it names that exist (with their options, variants, prices and
 * stock items), the SKUs it uses, and the shop's defaults.
 */

export interface ImportTemplate {
  id: string
  definitions: DefinitionShape[]
}

export interface Named {
  id: string
  name: string
}

export interface ImportReferences {
  /** By handle. */
  categories: Map<string, Named>
  collections: Map<string, Named>
  brands: Map<string, Named>
  templates: Map<string, ImportTemplate>
  products: Map<string, ExistingProduct>
  /** SKU (lower case) → the product handle that holds it. */
  skus: Map<string, string>
  shop: {
    locationId: string | null
    salesChannelId: string | null
    shippingProfileId: string | null
    units: SheetUnits
  }
}

const unique = (values: Iterable<string | undefined>): string[] => [
  ...new Set([...values].filter((value): value is string => Boolean(value))),
]

async function templatesOf(container: MedusaContainer, handles: string[]) {
  const templates = handles.length
    ? await container
        .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
        .listAttributeTemplates({ handle: handles }, { relations: ["definitions"] })
    : []
  return new Map(
    templates.map((template) => [
      template.handle,
      {
        id: template.id,
        definitions: template.definitions.map((definition) => ({
          key: definition.key,
          type: definition.type,
          scope: definition.scope,
          is_required: definition.is_required,
          options: definition.options as AttributeOption[] | null,
        })),
      },
    ])
  )
}

async function skusOf(container: MedusaContainer, skus: string[]) {
  const held = new Map<string, string>()
  for (const chunk of chunksOf(skus)) {
    const variants = await container
      .resolve(Modules.PRODUCT)
      .listProductVariants({ sku: chunk }, { select: ["sku"], relations: ["product"] })
    for (const variant of variants) {
      if (variant.sku && variant.product) {
        held.set(variant.sku.toLowerCase(), variant.product.handle)
      }
    }
  }
  return held
}

async function shopOf(container: MedusaContainer): Promise<ImportReferences["shop"]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: stores }, { data: profiles }, settings] = await Promise.all([
    query.graph({ entity: "store", fields: ["default_location_id", "default_sales_channel_id"] }),
    query.graph({ entity: "shipping_profile", fields: ["id"], filters: { type: "default" } }),
    container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE).getSection("store"),
  ])
  const store = stores[0] as
    { default_location_id?: string | null; default_sales_channel_id?: string | null } | undefined
  const units = settings as unknown as StoreSettings
  return {
    locationId: store?.default_location_id ?? null,
    salesChannelId: store?.default_sales_channel_id ?? null,
    shippingProfileId: (profiles[0] as { id: string } | undefined)?.id ?? null,
    units: { weight: units.weight_unit, dimension: units.dimension_unit },
  }
}

/** Everything the sheet names, looked up in a few queries. */
export async function importReferences(
  container: MedusaContainer,
  products: readonly SheetProduct[]
): Promise<ImportReferences> {
  const product = container.resolve(Modules.PRODUCT)
  const fields = products.map((each) => each.fields)
  const categoryHandles = unique(fields.flatMap((each) => each.categories ?? []))
  const collectionHandles = unique(fields.map((each) => each.collection))
  const brandHandles = unique(fields.map((each) => each.brand))
  const [categories, collections, brands, templates, existing, skus, shop] = await Promise.all([
    categoryHandles.length
      ? product.listProductCategories(
          { handle: categoryHandles },
          { select: ["id", "handle", "name"] }
        )
      : [],
    collectionHandles.length
      ? product.listProductCollections(
          { handle: collectionHandles },
          { select: ["id", "handle", "title"] }
        )
      : [],
    brandHandles.length
      ? container
          .resolve<BrandsModuleService>(BRANDS_MODULE)
          .listBrands({ handle: brandHandles }, { select: ["id", "handle", "name"] })
      : [],
    templatesOf(container, unique(fields.map((each) => each.template))),
    // A title's handle may be taken too: such a row must name the product it updates
    existingProducts(container, unique(products.map((each) => each.handle))),
    skusOf(
      container,
      unique(products.flatMap((each) => each.variants.map((variant) => variant.sku)))
    ),
    shopOf(container),
  ])
  return {
    categories: new Map(categories.map((row) => [row.handle, { id: row.id, name: row.name }])),
    collections: new Map(collections.map((row) => [row.handle, { id: row.id, name: row.title }])),
    brands: new Map(brands.map((row) => [row.handle, { id: row.id, name: row.name }])),
    templates,
    products: existing,
    skus,
    shop,
  }
}

export type {
  CurrentFields,
  ExistingPrice,
  ExistingProduct,
  ExistingVariant,
} from "./existing-products"
