import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { textOf } from "../../../workflows/seo/highlight"
import type { HighlightValue } from "../../../workflows/seo/highlight"
import { plainText } from "../../seo/text"
import { aiValidationError } from "../errors"
import type { FactsContainer, RecordFacts } from "./types"

interface ProductRow {
  title: string
  subtitle?: string | null
  description?: string | null
  brand?: { name: string } | null
  categories?: ({ name: string; is_internal?: boolean | null } | null)[] | null
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
  "attribute_values.*",
  "attribute_values.definition.*",
] as const

/**
 * What may leave the shop of a product (adr/0071 §10), with
 * `productFacts`'s filter (workflows/content/drafts.ts): its own published
 * fields, public attributes only and the description as plain text. No
 * price, stock, order, customer or staff field is read at all; a category
 * the shop keeps to itself is left out too.
 */
export async function productFacts(container: FactsContainer, id: string): Promise<RecordFacts> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [...PRODUCT_FACT_FIELDS],
    filters: { id },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    throw aiValidationError("ai.unknown_entity")
  }
  return {
    name: product.title,
    subtitle: product.subtitle ?? null,
    brand: product.brand?.name ?? null,
    category:
      product.categories?.find((each) => each !== null && each.is_internal !== true)?.name ?? null,
    // Written for shoppers: the shop's own attributes stay out (adr/0005 T5)
    attributes: (product.attribute_values ?? []).flatMap((value) => {
      const text = value && value.definition?.is_public !== false ? textOf(value) : ""
      const label = value?.definition?.label
      return text && label ? [{ label, value: text }] : []
    }),
    description: product.description ? plainText(product.description) : null,
  }
}
