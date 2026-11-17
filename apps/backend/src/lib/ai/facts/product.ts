import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { textOf } from "../../../workflows/seo/highlight"
import type { HighlightValue } from "../../../workflows/seo/highlight"
import { plainText } from "../../seo/text"
import { aiValidationError } from "../errors"
import { shownCategory } from "./category"
import type { FactsContainer, RecordFacts } from "./types"

interface ProductRow {
  title: string
  subtitle?: string | null
  description?: string | null
  brand?: { name: string } | null
  categories?:
    ({ name: string; is_internal?: boolean | null; is_active?: boolean | null } | null)[] | null
  attribute_values?: (HighlightValue | null)[] | null
}

/** The query's fields: what a shopper sees of a product, and what tells a public attribute. */
export const PRODUCT_FACT_FIELDS = [
  "title",
  "subtitle",
  "description",
  "brand.name",
  "categories.name",
  "categories.is_internal",
  "categories.is_active",
  "attribute_values.*",
  "attribute_values.definition.*",
] as const

/** What may leave the shop of a product, before the personal data filter. */
export interface ProductFacts {
  name: string
  subtitle: string | null
  brand: string | null
  category: string | null
  /** Public attributes as the template names them: `{ label: "Malzeme", value: "Keten" }`. */
  attributes: { label: string; value: string }[]
  /** The description now, as plain text. */
  description: string | null
}

/**
 * What may leave the shop of a product (adr/0071 §10), with
 * adr/0005's filter (its draft routes read products through here too, until
 * docs/22 PR 2-2 removes them): its own published fields, public
 * attributes only and the description as plain text. No price, stock,
 * order, customer or staff field is read at all; a category the shop
 * keeps to itself or has closed is left out too. Null when there is no
 * such product.
 */
export async function readProductFacts(
  container: FactsContainer,
  id: string
): Promise<ProductFacts | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [...PRODUCT_FACT_FIELDS],
    filters: { id },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    return null
  }
  return {
    name: product.title,
    subtitle: product.subtitle ?? null,
    brand: product.brand?.name ?? null,
    category: product.categories?.find(shownCategory)?.name ?? null,
    // Written for shoppers: the shop's own attributes stay out (adr/0005 T5)
    attributes: (product.attribute_values ?? []).flatMap((value) => {
      const text = value && value.definition?.is_public !== false ? textOf(value) : ""
      const label = value?.definition?.label
      return text && label ? [{ label, value: text }] : []
    }),
    description: product.description ? plainText(product.description) : null,
  }
}

/** A product's facts for a suggestion; `ai.unknown_entity` when there is none. */
export async function productFacts(container: FactsContainer, id: string): Promise<RecordFacts> {
  const facts = await readProductFacts(container, id)
  if (!facts) {
    throw aiValidationError("ai.unknown_entity")
  }
  return { ...facts }
}
