import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { plainText } from "../../seo/text"
import { aiValidationError } from "../errors"
import { listingProductFacts } from "./listing-products"
import { SEO_FACT_FIELDS, seoFactsOf } from "./seo"
import type { SeoRow } from "./seo"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * What may leave the shop of a collection or a brand page (adr/0071 §10,
 * adr/0074 §4), as of a category (facts/category.ts): its name, its
 * description as plain text (the document's mirror, adr/0075), its search
 * fields and what it lists (published products in the storefront's
 * channels: a few names, frequent brands or categories, a count range).
 * A page the shop closed may be readied before it opens, as a category;
 * nothing of its products' prices or stock is read.
 */

export const COLLECTION_FACT_FIELDS = [
  "title",
  "collection_extension.description",
  ...SEO_FACT_FIELDS,
] as const

/** The brand's own fields, and its products' ids through the link (links/product-brand.ts). */
export const BRAND_FACT_FIELDS = ["name", "description", "products.id", ...SEO_FACT_FIELDS] as const

interface CollectionRow {
  title?: string | null
  collection_extension?: { description?: string | null } | null
  seo_meta?: SeoRow | null
}

interface BrandRow {
  name?: string | null
  description?: string | null
  products?: ({ id?: string | null } | null)[] | null
  seo_meta?: SeoRow | null
}

async function rowOf<T>(
  container: FactsContainer,
  entity: string,
  fields: readonly string[],
  id: string
) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity,
    fields: [...fields],
    filters: { id },
  })
  const row = data[0] as T | undefined
  if (!row) {
    throw aiValidationError("ai.unknown_entity")
  }
  return row
}

const textOf = (text: string | null | undefined): string | null =>
  text ? plainText(text) || null : null

export async function collectionFacts(container: FactsContainer, id: string): Promise<RecordFacts> {
  const row = await rowOf<CollectionRow>(
    container,
    "product_collection",
    COLLECTION_FACT_FIELDS,
    id
  )
  return {
    name: row.title ?? null,
    ...seoFactsOf(row.seo_meta),
    ...(await listingProductFacts(container, { collection_id: id }, "brands")),
    // Last: the longest field is the first the data block drops when it is too long
    description: textOf(row.collection_extension?.description),
  }
}

export async function brandFacts(container: FactsContainer, id: string): Promise<RecordFacts> {
  const row = await rowOf<BrandRow>(container, "brand", BRAND_FACT_FIELDS, id)
  const ids = (row.products ?? []).flatMap((product) =>
    typeof product?.id === "string" ? [product.id] : []
  )
  const listing =
    ids.length > 0
      ? await listingProductFacts(container, { id: ids }, "categories")
      : { products: null, categories: null, product_count: null }
  return {
    name: row.name ?? null,
    ...seoFactsOf(row.seo_meta),
    ...listing,
    description: textOf(row.description),
  }
}
