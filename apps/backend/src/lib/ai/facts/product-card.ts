import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { aiValidationError } from "../errors"
import type { CardAllowed, CardAttribute, CardAttributeType, CardOption } from "../product-card"
import { shownLineage } from "./category"
import type { TreeCategory } from "./category"
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
// Category rows read to walk their trees: far more than any shop keeps
const MAX_CATEGORY_ROWS = 2000
/** Product attributes of one template named at most. */
export const MAX_CARD_ATTRIBUTES = 40
/** Options of one attribute named at most. */
export const MAX_CARD_OPTIONS = 40
// Room for an attribute's line with its options
export const ATTRIBUTE_LINE_LENGTH = 900

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

/**
 * Every shown category of the shop, "Üst > Alt" under a parent, in
 * alphabetical order and uncut: one with an internal or closed ancestor
 * anywhere up its tree is not shown, nor one whose ancestors were not all
 * read. Those in `leaveOut` are left out. A caller that orders by its own
 * measure (a post's link candidates) cuts after ordering.
 */
export async function allShownCategories(
  container: FactsContainer,
  leaveOut: ReadonlySet<string> = new Set()
): Promise<{ id: string; name: string }[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "name", "is_active", "is_internal", "parent_category_id"],
    pagination: { take: MAX_CATEGORY_ROWS },
  })
  const rows = data as TreeCategory[]
  const byId = new Map(rows.map((row) => [row.id, row]))
  return rows
    .flatMap((row) => {
      const lineage = leaveOut.has(row.id) ? null : shownLineage(row, byId)
      if (!lineage) {
        return []
      }
      const parent = lineage[1]
      return [{ id: row.id, name: parent ? `${parent.name} > ${row.name}` : row.name }]
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
}

/**
 * The shop's shown categories (`allShownCategories`), the first
 * `MAX_CARD_CATEGORIES` alphabetically, under codes `k1`, `k2`…: those in
 * `leaveOut` (a product's own) are not named, and the codes count without them.
 */
export async function shownCategories(
  container: FactsContainer,
  leaveOut: ReadonlySet<string> = new Set()
): Promise<CardAllowed["categories"]> {
  return (await allShownCategories(container, leaveOut))
    .slice(0, MAX_CARD_CATEGORIES)
    .map((row, index) => ({ code: `k${String(index + 1)}`, ...row }))
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
