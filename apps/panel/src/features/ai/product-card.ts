/**
 * A product card from a photo (docs/22 "Aşama 6"), as the backend answers
 * it: a name, a short description, one of the shop's categories and
 * values for the chosen template's attributes. Read again here, field by
 * field: anything else in the answer is never used, and there is no
 * price, stock or status in it to use.
 */

export type ProductCardValue = string | number | boolean | string[]

export interface ProductCard {
  title: string
  short_description: string | null
  category_id: string | null
  attributes: Record<string, ProductCardValue>
}

export const PRODUCT_FROM_PHOTO_TASK = "product_from_photo"

const isValue = (value: unknown): value is ProductCardValue =>
  typeof value === "string" ||
  (typeof value === "number" && Number.isFinite(value)) ||
  typeof value === "boolean" ||
  (Array.isArray(value) && value.every((each) => typeof each === "string"))

/** The card of an answer, its four fields only; null when it has no name. */
export function readProductCard(raw: unknown): ProductCard | null {
  if (typeof raw !== "object" || raw === null) {
    return null
  }
  const card = raw as Record<string, unknown>
  if (typeof card["title"] !== "string" || card["title"].trim() === "") {
    return null
  }
  const attributes =
    typeof card["attributes"] === "object" && card["attributes"] !== null
      ? Object.fromEntries(
          Object.entries(card["attributes"] as Record<string, unknown>).filter(
            (entry): entry is [string, ProductCardValue] => isValue(entry[1])
          )
        )
      : {}
  return {
    title: card["title"],
    short_description:
      typeof card["short_description"] === "string" ? card["short_description"] : null,
    category_id: typeof card["category_id"] === "string" ? card["category_id"] : null,
    attributes,
  }
}
