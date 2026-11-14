import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { batchPriceListPricesWorkflow, createPriceListsWorkflow } from "@medusajs/medusa/core-flows"
import { summaryDocOfText } from "../../lib/catalog/summary"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import { setProductBrandWorkflow } from "../../workflows/brands/workflows"
import { setProductCatalogWorkflow } from "../../workflows/catalog/set-product-catalog"
import { upsertProductAttributesWorkflow } from "../../workflows/product-attributes/upsert-product-attributes"
import { TRY_CURRENCY_CODE } from "../bootstrap/constants"
import type { DemoCatalog, DemoCatalogProduct } from "./schema"

export interface DetailContext {
  catalogName: string
  categoryIds: Map<string, string>
  brandIds: Map<string, string>
}

/**
 * What a product carries beside Medusa's own fields, each through the
 * workflow the panel saves it with: its primary category and short
 * description, its brand, its attribute template and values.
 */
export async function setDemoProductDetails(
  container: MedusaContainer,
  productId: string,
  product: DemoCatalogProduct,
  context: DetailContext
): Promise<void> {
  const primary = context.categoryIds.get(product.categories[0] ?? "")
  await setProductCatalogWorkflow(container).run({
    input: {
      product_id: productId,
      ...(primary ? { primary_category_id: primary } : {}),
      ...(product.summary ? { summary_doc: summaryDocOfText(product.summary) } : {}),
    },
  })
  const brandId = product.brand ? context.brandIds.get(product.brand) : undefined
  if (product.brand && !brandId) {
    throw new Error(`demo-catalog: ${product.handle} names an unknown brand ${product.brand}`)
  }
  if (brandId) {
    await setProductBrandWorkflow(container).run({
      input: { product_id: productId, brand_id: brandId },
    })
  }
  if (product.template) {
    const [template] = await container
      .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
      .listAttributeTemplates({ handle: product.template }, { select: ["id"], take: 1 })
    if (!template) {
      throw new Error(
        `demo-catalog: ${product.handle} names an unknown template ${product.template}`
      )
    }
    await upsertProductAttributesWorkflow(container).run({
      input: { product_id: productId, template_id: template.id, values: product.attributes },
    })
  }
}

/**
 * The file's reviews of a product, written as reviews brought from
 * elsewhere are (approved, dated as given, no order behind them): each has
 * a source key, so a second run writes none again.
 */
export async function addDemoReviews(
  container: MedusaContainer,
  productId: string,
  product: DemoCatalogProduct,
  catalogName: string
): Promise<number> {
  if (product.reviews.length === 0) {
    return 0
  }
  const service = container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
  const sources = product.reviews.map(
    (_, index) => `demo-catalog ${catalogName}:${product.handle}:${String(index + 1)}`
  )
  const before = await service.listProductReviews({ source_ref: sources }, { select: ["id"] })
  await service.addMigratedReviews(
    product.reviews.map((review, index) => ({
      source_ref: sources[index] ?? "",
      product_id: productId,
      customer_id: null,
      rating: review.rating,
      title: review.title,
      body: review.body,
      author_name: review.author,
      has_link: false,
      published: true,
      created_at: review.date,
    }))
  )
  return product.reviews.length - before.length
}

interface PriceListRow {
  id: string
  prices?: ({ price_set?: { variant?: { id: string } | null } | null } | null)[] | null
}

/**
 * The file's sale price list (an active Medusa sale list, as the panel
 * makes one), holding each variant's sale price; a variant the list
 * already prices is left as it is.
 */
export async function ensureSalePrices(
  container: MedusaContainer,
  sale: NonNullable<DemoCatalog["sale"]>,
  wanted: readonly { variant_id: string; amount: number }[]
): Promise<number> {
  if (wanted.length === 0) {
    return 0
  }
  const prices = wanted.map((price) => ({ ...price, currency_code: TRY_CURRENCY_CODE }))
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "price_list",
    fields: ["id", "prices.price_set.variant.id"],
    filters: { title: sale.title },
  })
  const list = (data as unknown as PriceListRow[])[0]
  if (!list) {
    await createPriceListsWorkflow(container).run({
      input: {
        price_lists_data: [
          { title: sale.title, description: sale.description, status: "active", prices },
        ],
      },
    })
    return prices.length
  }
  const priced = new Set((list.prices ?? []).map((price) => price?.price_set?.variant?.id))
  const missing = prices.filter((price) => !priced.has(price.variant_id))
  if (missing.length > 0) {
    await batchPriceListPricesWorkflow(container).run({
      input: { data: { id: list.id, create: missing, update: [], delete: [] } },
    })
  }
  return missing.length
}
