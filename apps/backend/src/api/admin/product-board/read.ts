import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createSingleFlight } from "../../../lib/cache"
import { categoryAndBelow, isColumnOrder, scanProducts } from "../../../lib/catalog/product-board"
import type { BoardProduct, ProductOrder } from "../../../lib/catalog/product-board"
import { lowStockThresholds } from "../../../lib/stock"
import ProductBrandLink from "../../../links/product-brand"
import { SEO_ADVISOR_MODULE } from "../../../modules/seo-advisor"
import type SeoAdvisorModuleService from "../../../modules/seo-advisor/service"
import type { AdminGetProductBoardType } from "./validators"

// Products read at most for a filter or order Medusa's query cannot do (docs/05); past it `limited`
export const MAX_SCANNED = 5000

// Grades the advisor would have the shop work on (docs/14 §1)
const SEO_WORK: ("needs_work" | "poor")[] = ["needs_work", "poor"]

type Filters = Record<string, unknown>

// Views and pages asked at once share one read of the rows (docs/04)
const scanRead = createSingleFlight<{
  data: unknown[]
  metadata?: { count?: number } | undefined
}>()

interface Answer {
  ids: string[]
  count: number
  /** More products matched Medusa's filters than one scan reads: the rest are left out. */
  limited: boolean
}

const EMPTY: Answer = { ids: [], count: 0, limited: false }

/** The products of a brand (F3.11), through the link's own table. */
async function brandProducts(scope: MedusaContainer, brandId: string): Promise<string[]> {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: ProductBrandLink.entryPoint,
    fields: ["product_id"],
    filters: { brand_id: brandId },
  })
  return (data as { product_id: string }[]).map((row) => row.product_id)
}

/** Products the advisor graded "needs work" or "poor" (docs/14). */
async function seoWorkProducts(scope: MedusaContainer): Promise<string[]> {
  const rows = await scope
    .resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)
    .listSeoAssessments({ entity_type: "product", grade: SEO_WORK }, { select: ["entity_id"] })
  return rows.map((row) => row.entity_id)
}

async function categoryIds(scope: MedusaContainer, categoryId: string): Promise<string[]> {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "parent_category_id"],
  })
  return categoryAndBelow(categoryId, data)
}

const intersect = (current: Set<string> | null, next: readonly string[]): Set<string> =>
  new Set(current ? next.filter((id) => current.has(id)) : next)

/** What Medusa's product query filters itself: search, state, type, categories, id sets. */
async function baseFilters(
  scope: MedusaContainer,
  params: AdminGetProductBoardType
): Promise<Filters | null> {
  const [brand, seo, categories] = await Promise.all([
    params.brand_id ? brandProducts(scope, params.brand_id) : null,
    params.missing === "seo" ? seoWorkProducts(scope) : null,
    params.category_id ? categoryIds(scope, params.category_id) : null,
  ])
  let ids: Set<string> | null = null
  for (const set of [brand, seo]) {
    if (set) {
      ids = intersect(ids, set)
    }
  }
  if (ids?.size === 0) {
    return null
  }
  return {
    ...(params.q ? { q: params.q } : {}),
    ...(params.status ? { status: [params.status] } : {}),
    ...(params.type_id ? { type_id: [params.type_id] } : {}),
    ...(categories ? { categories: { id: categories } } : {}),
    ...(ids ? { id: [...ids] } : {}),
  }
}

const orderOf = (order: ProductOrder): Record<string, "ASC" | "DESC"> => ({
  [order.replace(/^-/, "")]: order.startsWith("-") ? "DESC" : "ASC",
})

// What the scan reads: only the relations its filters and order need
function scanFields(params: AdminGetProductBoardType): string[] {
  const order = params.order.replace(/^-/, "")
  const stock = params.stock !== undefined || order === "stock"
  const price = params.missing === "price" || order === "price"
  return [
    "id",
    "title",
    "created_at",
    "updated_at",
    ...(params.kind ? ["product_extension.kind"] : []),
    ...(params.missing === "image" ? ["thumbnail", "images.id"] : []),
    ...(params.missing === "description" ? ["description"] : []),
    ...(stock || price ? ["variants.id"] : []),
    ...(price ? ["variants.prices.amount", "variants.prices.currency_code"] : []),
    ...(stock
      ? [
          "variants.manage_inventory",
          "variants.allow_backorder",
          "variants.inventory_items.inventory_item_id",
          "variants.inventory_items.inventory.location_levels.stocked_quantity",
          "variants.inventory_items.inventory.location_levels.reserved_quantity",
        ]
      : []),
  ]
}

const needsScan = (params: AdminGetProductBoardType): boolean =>
  !isColumnOrder(params.order) ||
  params.kind !== undefined ||
  params.stock !== undefined ||
  (params.missing !== undefined && params.missing !== "seo")

/**
 * The panel's product list (adr/0022): the ids of a page in the order
 * asked, how many match, and whether the scan stopped short. Medusa's
 * query filters and pages what it can; a filter or order over prices,
 * stock, the kind or what is missing reads the newest MAX_SCANNED
 * matching rows and works over them here. The panel loads the page's
 * products by these ids.
 */
export async function readProductBoard(
  scope: MedusaContainer,
  params: AdminGetProductBoardType
): Promise<Answer> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const filters = await baseFilters(scope, params)
  if (!filters) {
    return EMPTY
  }
  if (!needsScan(params)) {
    const { data, metadata } = await query.graph({
      entity: "product",
      fields: ["id"],
      filters: filters,
      pagination: { skip: params.offset, take: params.limit, order: orderOf(params.order) },
    })
    return {
      ids: (data as { id: string }[]).map((row) => row.id),
      count: metadata?.count ?? data.length,
      limited: false,
    }
  }
  const fields = scanFields(params)
  const { data, metadata } = await scanRead(JSON.stringify({ filters, fields }), () =>
    query.graph({
      entity: "product",
      fields,
      filters: filters,
      pagination: { skip: 0, take: MAX_SCANNED, order: { updated_at: "DESC" } },
    })
  )
  const rows = data as BoardProduct[]
  const itemIds = params.stock
    ? rows.flatMap((product) =>
        (product.variants ?? []).flatMap((variant) =>
          (variant?.inventory_items ?? []).flatMap((item) =>
            item?.inventory_item_id ? [item.inventory_item_id] : []
          )
        )
      )
    : []
  const thresholds = await lowStockThresholds(scope, [...new Set(itemIds)])
  const ids = scanProducts(
    rows,
    { stock: params.stock, missing: params.missing, kind: params.kind, order: params.order },
    thresholds.of
  )
  return {
    ids: ids.slice(params.offset, params.offset + params.limit),
    count: ids.length,
    limited: (metadata?.count ?? rows.length) > rows.length,
  }
}

export type ProductBoard = Awaited<ReturnType<typeof readProductBoard>>
