import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { plainText } from "../../seo/text"
import { aiValidationError } from "../errors"
import type { FactsContainer, RecordFacts } from "./types"

export interface NamedCategory {
  name: string
  is_internal?: boolean | null
  is_active?: boolean | null
}

interface CategoryRow extends NamedCategory {
  description?: string | null
  parent_category?: NamedCategory | null
  category_children?: (NamedCategory | null)[] | null
}

/** Sub-categories named at most; a listing page is told by its name and a few of its parts. */
export const MAX_CHILD_CATEGORIES = 10

export const CATEGORY_FACT_FIELDS = [
  "name",
  "description",
  "is_internal",
  "parent_category.name",
  "parent_category.is_internal",
  "parent_category.is_active",
  "category_children.name",
  "category_children.is_internal",
  "category_children.is_active",
] as const

// The record asked for: a closed one may still be readied for opening, an internal one has no page
const ownPage = (category: NamedCategory | null | undefined): category is NamedCategory =>
  !!category && category.is_internal !== true

/** A category shoppers see now: neither internal nor closed. Its relatives are named only then. */
export const shownCategory = (
  category: NamedCategory | null | undefined
): category is NamedCategory => ownPage(category) && category.is_active !== false

/**
 * What may leave the shop of a category (adr/0071 §10): its name and
 * description, and the names of the parent and sub-categories shoppers
 * see (neither internal nor closed). A category the shop keeps to itself
 * has no page to describe and is answered as unknown; a closed one may be
 * readied before it opens; nothing of its products' prices or stock is read.
 */
export async function categoryFacts(container: FactsContainer, id: string): Promise<RecordFacts> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: [...CATEGORY_FACT_FIELDS],
    filters: { id },
  })
  const category = data[0] as CategoryRow | undefined
  if (!ownPage(category)) {
    throw aiValidationError("ai.unknown_entity")
  }
  const children = (category.category_children ?? [])
    .filter(shownCategory)
    .slice(0, MAX_CHILD_CATEGORIES)
    .map((child) => child.name)
  return {
    name: category.name,
    parent: shownCategory(category.parent_category) ? category.parent_category.name : null,
    subcategories: children.length > 0 ? children.join(", ") : null,
    description: category.description ? plainText(category.description) : null,
  }
}
