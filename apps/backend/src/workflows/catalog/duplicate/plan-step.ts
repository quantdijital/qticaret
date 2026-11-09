import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { readProductAttributes } from "../../../api/admin/products/[id]/attributes/read"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import {
  GIFT_CARDS,
  PRODUCT_ADDONS,
  RESTRICTED_PRODUCTS,
} from "../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { freeCopyHandle } from "./handle"
import { copyPlan } from "./plan"
import type { CopyPlan, SourceProduct } from "./plan"

const SOURCE_FIELDS = [
  "id",
  "title",
  "handle",
  "subtitle",
  "description",
  "thumbnail",
  "weight",
  "length",
  "width",
  "height",
  "origin_country",
  "hs_code",
  "mid_code",
  "material",
  "discountable",
  "type_id",
  "collection_id",
  "tags.id",
  "categories.id",
  "sales_channels.id",
  "shipping_profile.id",
  "images.url",
  "images.rank",
  "images.variants.id",
  "options.id",
  "options.title",
  "options.values.value",
  "variants.id",
  "variants.title",
  "variants.variant_rank",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.weight",
  "variants.length",
  "variants.width",
  "variants.height",
  "variants.options.value",
  "variants.options.option_id",
  "variants.prices.amount",
  "variants.prices.currency_code",
  "variants.prices.price_list_id",
  "variants.prices.rules_count",
  "variants.variant_extension.cost",
  "brand.id",
  "seo_meta.*",
  "product_extension.*",
]

export type ProductCopyPlan = CopyPlan & { source_id: string; handle: string }

/**
 * Reads the product to copy and plans its copy (`copyPlan`) on a free
 * address; writes nothing, so it has nothing to undo. The shop's flags
 * decide which marks the copy can carry: one off leaves it out.
 */
export const planProductCopyStep = createStep(
  "catalog-plan-product-copy",
  async (input: { product_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product",
      fields: SOURCE_FIELDS,
      filters: { id: input.product_id },
    })
    const source = data[0] as (SourceProduct & { handle: string }) | undefined
    if (!source) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
    }
    const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const [handle, giftCards, addons, restricted, attributes] = await Promise.all([
      freeCopyHandle(container, source.handle),
      settings.isFeatureEnabled(GIFT_CARDS),
      settings.isFeatureEnabled(PRODUCT_ADDONS),
      settings.isFeatureEnabled(RESTRICTED_PRODUCTS),
      readProductAttributes(container, source.id),
    ])
    const plan = copyPlan(
      source,
      handle,
      { giftCards, addons, restricted },
      { template_id: attributes.template?.id ?? null, values: attributes.values }
    )
    return new StepResponse<ProductCopyPlan>({ ...plan, source_id: source.id, handle })
  }
)
