import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { aiValidationError } from "../errors"
import type { CardAllowed, CardAttribute, CardAttributeType, CardOption } from "../product-card"
import { shownCategory } from "./category"
import type { NamedCategory } from "./category"
import { mediaFacts } from "./media"
import type { AiImageRef } from "./media"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * What a product card from a photo is asked with (Aşama 6, docs/22;
 * adr/0071 §10): the photo itself (read by its stored file, EXIF and GPS
 * dropped at upload), the names of the shop's shown categories under short
 * codes, and the chosen template's product attributes with their options.
 * Nothing of the image record (its file name, uploader or alt text), no
 * product, price, stock, order, customer or staff field is read. The same
 * lists come back as `allowed`: the only categories and attributes the
 * answer may name (lib/ai/product-card.ts).
 */

/** Shown categories named in one prompt at most; the data block keeps its own ceiling too. */
export const MAX_CARD_CATEGORIES = 150
/** Product attributes of one template named at most. */
export const MAX_CARD_ATTRIBUTES = 40
/** Options of one attribute named at most. */
const MAX_CARD_OPTIONS = 40
// Room for an attribute's line with its options
const ATTRIBUTE_LINE_LENGTH = 900

interface CategoryRow extends NamedCategory {
  id: string
  parent_category?: NamedCategory | null
}

interface DefinitionRow {
  key: string
  label: string
  type: CardAttributeType
  unit?: string | null
  options?: CardOption[] | null
  scope?: "product" | "variant" | null
  rank?: number | null
}

export interface ProductCardFacts {
  fields: RecordFacts
  maxLengths: Readonly<Record<string, number>>
  maxItems: Readonly<Record<string, number>>
  allowed: CardAllowed
  image: AiImageRef
}

const TEMPLATE_ID = /^atpl_[A-Za-z0-9]{1,40}$/

/** The shop's shown categories, "Üst > Alt" when the parent is shown too, under codes `k1`, `k2`… */
async function shownCategories(container: FactsContainer): Promise<CardAllowed["categories"]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "is_active",
      "is_internal",
      "parent_category.name",
      "parent_category.is_active",
      "parent_category.is_internal",
    ],
    pagination: { take: MAX_CARD_CATEGORIES * 2 },
  })
  return (
    (data as CategoryRow[])
      // Under a parent shoppers cannot see, a category is not shown either
      .filter(
        (row) => shownCategory(row) && (!row.parent_category || shownCategory(row.parent_category))
      )
      .map((row) => ({
        id: row.id,
        name: row.parent_category ? `${row.parent_category.name} > ${row.name}` : row.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .slice(0, MAX_CARD_CATEGORIES)
      .map((row, index) => ({ code: `k${String(index + 1)}`, ...row }))
  )
}

/** The template's product attributes in its order; none without a template. */
async function templateAttributes(
  container: FactsContainer,
  templateId: string | null | undefined
): Promise<CardAttribute[]> {
  if (!templateId) {
    return []
  }
  if (!TEMPLATE_ID.test(templateId)) {
    throw aiValidationError("ai.unknown_entity")
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "attribute_template",
    fields: [
      "id",
      "definitions.key",
      "definitions.label",
      "definitions.type",
      "definitions.unit",
      "definitions.options",
      "definitions.scope",
      "definitions.rank",
    ],
    filters: { id: templateId },
  })
  const template = data[0] as { definitions?: (DefinitionRow | null)[] | null } | undefined
  if (!template) {
    throw aiValidationError("ai.unknown_entity")
  }
  // A variant attribute is the product's options (sizes, colours): not a card's
  return (template.definitions ?? [])
    .filter((row): row is DefinitionRow => !!row && (row.scope ?? "product") === "product")
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.key.localeCompare(b.key))
    .slice(0, MAX_CARD_ATTRIBUTES)
    .map((row) => ({
      key: row.key,
      label: row.label,
      type: row.type,
      unit: row.unit ?? null,
      options:
        row.type === "select" || row.type === "multi_select"
          ? (row.options ?? []).slice(0, MAX_CARD_OPTIONS)
          : null,
    }))
}

const TYPE_WORDS: Readonly<Record<CardAttributeType, string>> = {
  text: "metin",
  number: "sayı",
  boolean: "evet/hayır (true/false)",
  select: "tek seçim",
  multi_select: "çoklu seçim (dizi)",
}

/** An attribute as the prompt describes it: label, kind, unit and options (`değer = ad`). */
export function attributeLine(attribute: CardAttribute): string {
  const parts = [attribute.label, TYPE_WORDS[attribute.type]]
  if (attribute.unit) {
    parts.push(`birim: ${attribute.unit}`)
  }
  if (attribute.options && attribute.options.length > 0) {
    parts.push(
      `seçenekler: ${attribute.options.map((each) => `${each.value} = ${each.label}`).join("; ")}`
    )
  }
  return parts.join(" · ")
}

export async function productCardFacts(
  container: FactsContainer,
  mediaId: string,
  templateId?: string | null
): Promise<ProductCardFacts> {
  // The image record is checked (stored, readable); of it only the file goes on
  const { image } = await mediaFacts(container, mediaId)
  const categories = await shownCategories(container)
  const attributes = await templateAttributes(container, templateId)
  return {
    fields: {
      categories: categories.map((each) => ({ label: each.code, value: each.name })),
      attributes: attributes.map((each) => ({ label: each.key, value: attributeLine(each) })),
    },
    maxLengths: { attributes: ATTRIBUTE_LINE_LENGTH },
    maxItems: { categories: MAX_CARD_CATEGORIES, attributes: MAX_CARD_ATTRIBUTES },
    allowed: { categories, attributes },
    image,
  }
}
