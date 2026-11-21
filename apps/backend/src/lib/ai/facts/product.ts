import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { textOf } from "../../../workflows/seo/highlight"
import type { HighlightValue } from "../../../workflows/seo/highlight"
import { plainText } from "../../seo/text"
import { aiValidationError } from "../errors"
import { PLACED_CATEGORY_FIELDS, shownCategoryIds } from "./category-tree"
import type { PlacedCategory } from "./category-tree"
import { SEO_FACT_FIELDS, seoFactsOf } from "./seo"
import type { SeoRow } from "./seo"
import type { FactsContainer, RecordFacts } from "./types"

interface ProductRow {
  title: string
  subtitle?: string | null
  description?: string | null
  brand?: { name: string; is_active?: boolean | null } | null
  categories?: (PlacedCategory | null)[] | null
  attribute_values?: (HighlightValue | null)[] | null
  options?:
    | ({ title?: string | null; values?: ({ value?: string | null } | null)[] | null } | null)[]
    | null
  collection?: {
    title?: string | null
    collection_extension?: { is_active?: boolean | null } | null
  } | null
  tags?: ({ value?: string | null } | null)[] | null
  seo_meta?: SeoRow | null
}

/** The query's fields: what a shopper sees of a product, and what tells a public attribute. */
export const PRODUCT_FACT_FIELDS = [
  "title",
  "subtitle",
  "description",
  "brand.name",
  "brand.is_active",
  // Ids and paths too: a category under an internal or closed parent is not named (#250 D1)
  ...PLACED_CATEGORY_FIELDS,
  "attribute_values.*",
  "attribute_values.definition.*",
  // What a shopper picks among (Renk: siyah, kahve), the collection and tags it is listed under
  "options.title",
  "options.values.value",
  "collection.title",
  // A collection the shop hid is not named (#250 B1), as a closed brand or category
  "collection.collection_extension.is_active",
  "tags.value",
] as const

/** Options named at most, and values of one option; tags at most. */
export const MAX_PRODUCT_OPTIONS = 5
export const MAX_OPTION_VALUES = 12
export const MAX_PRODUCT_TAGS = 10

// What Medusa names the option of a product made without any: nothing for a shopper to pick
const DEFAULT_OPTION = "Default option"

/** What may leave the shop of a product, before the personal data filter. */
export interface ProductFacts {
  name: string
  subtitle: string | null
  brand: string | null
  category: string | null
  /** The collection it is listed under, shown on the storefront. */
  collection: string | null
  /** Its tags, joined: "yaz, keten". */
  tags: string | null
  /** What a shopper picks among: `{ label: "Renk", value: "siyah, kahve" }`. */
  options: { label: string; value: string }[]
  /** Public attributes as the template names them: `{ label: "Malzeme", value: "Keten" }`. */
  attributes: { label: string; value: string }[]
  /** The description now, as plain text. */
  description: string | null
}

const present = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim() !== ""

function optionsOf(row: ProductRow): { label: string; value: string }[] {
  return (row.options ?? []).flatMap((option) => {
    const label = option?.title
    if (!present(label) || label === DEFAULT_OPTION) {
      return []
    }
    const values = (option?.values ?? [])
      .map((each) => each?.value)
      .filter(present)
      .slice(0, MAX_OPTION_VALUES)
    return values.length > 0 ? [{ label, value: values.join(", ") }] : []
  })
}

function tagsOf(row: ProductRow): string | null {
  const tags = (row.tags ?? [])
    .map((tag) => tag?.value)
    .filter(present)
    .slice(0, MAX_PRODUCT_TAGS)
  return tags.length > 0 ? tags.join(", ") : null
}

async function productRow(
  container: FactsContainer,
  id: string,
  seo: boolean
): Promise<ProductRow | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [...PRODUCT_FACT_FIELDS, ...(seo ? SEO_FACT_FIELDS : [])],
    filters: { id },
  })
  return (data[0] as ProductRow | undefined) ?? null
}

// The collection's own row says whether its page is public; no row: it is (workflows/catalog/collection-fields.ts)
const shownCollection = (product: ProductRow): string | null => {
  const collection = product.collection
  return present(collection?.title) && collection.collection_extension?.is_active !== false
    ? collection.title
    : null
}

async function factsOf(container: FactsContainer, product: ProductRow): Promise<ProductFacts> {
  const categories = product.categories ?? []
  const shownIds = await shownCategoryIds(container, categories)
  return {
    name: product.title,
    subtitle: product.subtitle ?? null,
    // A brand the shop closed is not named (as a category it closed)
    brand: product.brand?.is_active === false ? null : (product.brand?.name ?? null),
    category:
      categories.find((category) => typeof category?.id === "string" && shownIds.has(category.id))
        ?.name ?? null,
    collection: shownCollection(product),
    tags: tagsOf(product),
    options: optionsOf(product).slice(0, MAX_PRODUCT_OPTIONS),
    // Written for shoppers: the shop's own attributes stay out (adr/0005 T5)
    attributes: (product.attribute_values ?? []).flatMap((value) => {
      const text = value && value.definition?.is_public !== false ? textOf(value) : ""
      const label = value?.definition?.label
      return text && label ? [{ label, value: text }] : []
    }),
    description: product.description ? plainText(product.description) : null,
  }
}

/**
 * What may leave the shop of a product (adr/0071 §10), with
 * adr/0005's filter (its draft routes read products through here too, until
 * docs/22 PR 2-2 removes them): its own published fields, its options,
 * collection and tags, public attributes only and the description as
 * plain text. No price, stock, order, customer or staff field is read at
 * all; a category the shop keeps to itself or has closed is left out too,
 * as a brand it closed.
 * Null when there is no such product.
 */
export async function readProductFacts(
  container: FactsContainer,
  id: string
): Promise<ProductFacts | null> {
  const product = await productRow(container, id, false)
  return product ? factsOf(container, product) : null
}

/**
 * A product's facts for a suggestion about its own page, with its search
 * fields (adr/0074 §4: the focus keyword, the search title and
 * description now); `ai.unknown_entity` when there is none.
 */
export async function productFacts(container: FactsContainer, id: string): Promise<RecordFacts> {
  const product = await productRow(container, id, true)
  if (!product) {
    throw aiValidationError("ai.unknown_entity")
  }
  return { ...(await factsOf(container, product)), ...seoFactsOf(product.seo_meta) }
}
