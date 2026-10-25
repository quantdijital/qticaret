import { parseMoneyInput } from "@/lib/money-input"
import { hasMeasures } from "./schema"
import type { WizardValues } from "./schema"

// docs/14 P-CONT-01: the advisor asks for 150 words
export const SUGGESTED_WORDS = 150

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

export type ReadinessKey = "title" | "price" | "measures" | "images" | "description" | "category"

export interface ReadinessItem {
  key: ReadinessKey
  done: boolean
  /** Publishing waits for it; the others are advice. */
  required: boolean
}

/**
 * What the review step lists before saving: the rules the server applies
 * to a published product (title, price, F3.1 measures) and the advisor's
 * first content checks (docs/14), done or not.
 */
export function readiness(values: WizardValues): ReadinessItem[] {
  const priced = values.variants.every((variant) => (parseMoneyInput(variant.price) ?? 0) > 0)
  return [
    { key: "title", done: values.title.trim().length >= 2, required: true },
    { key: "price", done: priced, required: true },
    { key: "measures", done: hasMeasures(values), required: true },
    { key: "images", done: values.images.length > 0, required: false },
    { key: "description", done: wordCount(values.description) >= SUGGESTED_WORDS, required: false },
    { key: "category", done: values.category_ids.length > 0, required: false },
  ]
}

export const canPublish = (items: ReadinessItem[]) =>
  items.every((item) => item.done || !item.required)
