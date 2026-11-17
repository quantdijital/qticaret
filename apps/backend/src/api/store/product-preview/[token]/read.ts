import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  QueryContext,
  getVariantAvailability,
} from "@medusajs/framework/utils"
import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import { PRODUCT_VIDEOS } from "../../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"
import { STORE_VIDEO_LEAVES } from "../../../http/media-routes"
import { shopperVideos } from "../../../http/store-product-videos"
import { productTexts } from "../../products/[id]/description/read"

// The product page's fields (the storefront's `PAGE_FIELDS`), prices in the lira region
const FIELDS = [
  "id",
  "title",
  "handle",
  "subtitle",
  "description",
  "thumbnail",
  "status",
  "updated_at",
  "brand.id",
  "brand.name",
  "brand.handle",
  "media_assets.id",
  "media_assets.url",
  "media_assets.width",
  "media_assets.height",
  "media_assets.alt",
  "media_assets.derivatives",
  "images.id",
  "images.url",
  "images.rank",
  "images.variants.id",
  "categories.id",
  "options.id",
  "options.title",
  "options.values.id",
  "options.values.value",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.options.id",
  "variants.options.value",
  "variants.options.option_id",
  "attribute_values.id",
  "attribute_values.value_text",
  "attribute_values.value_number",
  "attribute_values.value_boolean",
  "attribute_values.value_options",
  "attribute_values.definition.key",
  "attribute_values.definition.label",
  "attribute_values.definition.type",
  "attribute_values.definition.unit",
  "attribute_values.definition.rank",
  "attribute_values.definition.options",
  "attribute_values.definition.is_seo_highlight",
  "attribute_values.definition.is_public",
  "attribute_values.definition.group",
  "attribute_values.definition.template.groups",
  "product_extension.is_gift_card",
  "product_extension.withdrawal_excluded",
  "product_extension.kind",
  "product_extension.description_doc",
  "product_extension.summary_doc",
  // Its videos (adr/0069 §6): the Store API's own leaves, the ready ones while the flag is on
  ...STORE_VIDEO_LEAVES,
]

const CURRENCY = "try"

interface VariantRow {
  id: string
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_quantity?: number
}

interface ValueRow {
  definition?: { is_public?: boolean | null } | null
}

interface ProductRow {
  id: string
  updated_at: string | Date
  variants?: (VariantRow | null)[] | null
  attribute_values?: (ValueRow | null)[] | null
  product_extension?: {
    description_doc?: unknown
    summary_doc?: unknown
    [field: string]: unknown
  } | null
  [field: string]: unknown
}

/** The product's saved moment, for the token's check; null for none. */
export async function previewedProduct(
  container: Pick<MedusaContainer, "resolve">,
  id: string
): Promise<{ id: string; updated_at: string | Date } | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "updated_at"],
    filters: { id },
  })
  return (data[0] as { id: string; updated_at: string | Date } | undefined) ?? null
}

/**
 * A product's page as the storefront reads it, whatever its state (F18
 * preview): priced in the lira region, stock counted for the shopper's
 * sales channel, the shop's private attributes left out, its descriptions
 * as HTML, its ready videos as the Store API gives them (adr/0069 §6). The
 * documents themselves stay here.
 */
export async function previewProductPage(
  container: Pick<MedusaContainer, "resolve">,
  id: string,
  salesChannelId: string | null
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { currency_code: CURRENCY },
    pagination: { take: 1 },
  })
  const regionId = (regions[0] as { id: string } | undefined)?.id
  const { data } = await query.graph({
    entity: "product",
    // Priced only where the shop has its lira region (a fresh test shop has none)
    fields: regionId ? [...FIELDS, "variants.calculated_price.*"] : FIELDS,
    filters: { id },
    ...(regionId
      ? {
          context: {
            variants: {
              calculated_price: QueryContext({ region_id: regionId, currency_code: CURRENCY }),
            },
          },
        }
      : {}),
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    return null
  }
  const variants = (product.variants ?? []).filter((each): each is VariantRow => Boolean(each))
  const counted = variants.filter((each) => each.manage_inventory).map((each) => each.id)
  const availability =
    counted.length > 0 && salesChannelId
      ? await getVariantAvailability(query, {
          variant_ids: counted,
          sales_channel_id: salesChannelId,
        })
      : {}
  for (const variant of variants) {
    variant.inventory_quantity = variant.manage_inventory
      ? (availability[variant.id]?.availability ?? 0)
      : 0
  }
  const videosOn = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(PRODUCT_VIDEOS)
  shopperVideos(product, videosOn)
  product.attribute_values = (product.attribute_values ?? []).filter(
    (value) => value?.definition?.is_public !== false
  )
  const texts = await productTexts(container, product.product_extension)
  if (product.product_extension) {
    delete product.product_extension.description_doc
    delete product.product_extension.summary_doc
  }
  return { product, texts }
}
