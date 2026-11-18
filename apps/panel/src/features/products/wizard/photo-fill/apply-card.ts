import type { AttributeDefinition, AttributeValue } from "@/features/attributes/types"
import type { ProductCard } from "@/features/ai/product-card"
import { docOfParagraphs } from "@/features/products/description-doc"
import { MAX_IMAGES } from "@/features/products/components/image-gallery"
import type { WizardValues } from "../schema"

/** The photo the card was made from: a stored file, its address, its media record. */
export interface CardPhoto {
  id: string
  url: string
}

type CardFields = Pick<
  WizardValues,
  "title" | "summary_doc" | "category_ids" | "attributes" | "images"
>

/**
 * What "Kullan" puts in the new product form (docs/22 "Aşama 6"): the
 * name and short description, the category beside any already ticked,
 * the attributes the chosen template defines (an option only if it is
 * one of its options), and the photo as the product's first picture.
 * Nothing is written: the form saves it with the product, or not at all.
 */
export function cardFields(
  values: CardFields,
  card: ProductCard,
  photo: CardPhoto,
  definitions: readonly AttributeDefinition[],
  categoryIds: ReadonlySet<string>
): CardFields {
  const attributes: Record<string, AttributeValue> = { ...values.attributes }
  for (const definition of definitions) {
    const value = Object.hasOwn(card.attributes, definition.key)
      ? card.attributes[definition.key]
      : undefined
    if (value !== undefined && fits(definition, value)) {
      attributes[definition.key] = value
    }
  }
  const category = card.category_id && categoryIds.has(card.category_id) ? card.category_id : null
  const hasPhoto = values.images.some((image) => image.id === photo.id || image.url === photo.url)
  return {
    title: card.title,
    summary_doc: card.short_description
      ? docOfParagraphs(card.short_description)
      : values.summary_doc,
    category_ids:
      category && !values.category_ids.includes(category)
        ? [...values.category_ids, category]
        : values.category_ids,
    attributes,
    images: hasPhoto ? values.images : [photo, ...values.images].slice(0, MAX_IMAGES),
  }
}

// Read again against the definition: the backend did, and the form takes nothing else
function fits(definition: AttributeDefinition, value: AttributeValue): boolean {
  const options = new Set((definition.options ?? []).map((each) => each.value))
  switch (definition.type) {
    case "text":
      return typeof value === "string"
    case "number":
      return typeof value === "number"
    case "boolean":
      return typeof value === "boolean"
    case "select":
      return typeof value === "string" && options.has(value)
    case "multi_select":
      return Array.isArray(value) && value.every((each) => options.has(each))
  }
}
