import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { docStats, renderDoc } from "../../../lib/content"
import type { ContentDoc } from "../../../lib/content"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { LandingPageRecord } from "../../../modules/content/service"
import { CATALOG_ENTITY_TYPES } from "../../../workflows/catalog/entity-paths"
import { findFacet, landingProducts } from "../../../workflows/content/landing-facet"
import { activePathOf, ownerState } from "../../../workflows/seo/redirects/owners"
import { cardTargets } from "../content/cards"

const facetOf = (row: LandingPageRecord) => ({
  kind: row.facet_kind,
  key: row.facet_key,
  value: row.facet_value,
})

/** A live landing page (published, its category live), or 404 as if it did not exist. */
export async function liveLanding(
  container: MedusaContainer,
  id: string
): Promise<LandingPageRecord> {
  const owner = { entity_type: CATALOG_ENTITY_TYPES.landing, entity_id: id }
  const [row] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listLandingPages({ id }, { take: 1 })
  if (!row || (await ownerState(container, owner)).kind !== "live") {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.landing_unknown")
  }
  return row
}

/**
 * A landing page as the storefront shows it (F3.16): its text as HTML
 * (adr/0019), the category and facet it narrows (the storefront's filter
 * for the same view, F3.17) and how many products it lists.
 */
export async function storeLanding(container: MedusaContainer, id: string) {
  const row = await liveLanding(container, id)
  const body = row.body as unknown as ContentDoc
  const facet = facetOf(row)
  const [path, described, products, cards] = await Promise.all([
    activePathOf(container, { entity_type: CATALOG_ENTITY_TYPES.landing, entity_id: id }),
    findFacet(container, facet),
    landingProducts(container, { category_id: row.category_id, facet }, { skip: 0, take: 1 }),
    cardTargets(container, body),
  ])
  return {
    id: row.id,
    title: row.title,
    handle: row.handle,
    path,
    category_id: row.category_id,
    facet: { ...facet, label: described?.label ?? null },
    html: renderDoc(body, cards),
    headings: docStats(body).headings,
    product_count: products.count,
    published_at: row.published_at,
    revised_at: row.revised_at,
  }
}

/** A page of the landing page's products: ids, the newest first, for the Store product API. */
export async function storeLandingProducts(
  container: MedusaContainer,
  id: string,
  page: { offset: number; limit: number }
) {
  const row = await liveLanding(container, id)
  const { ids, count } = await landingProducts(
    container,
    { category_id: row.category_id, facet: facetOf(row) },
    { skip: page.offset, take: page.limit }
  )
  return { product_ids: ids, count, offset: page.offset, limit: page.limit }
}
