import type { BulkAction, BulkChange } from "@/features/products/api/bulk"
import { parseCountInput, parseDecimalInput, parseMoneyInput } from "@/lib/money-input"

/**
 * The bulk edit dialog's fields and the change they make (F3.10): what a
 * person types, checked here with the bounds the server keeps, so a bad
 * value is named on the field rather than refused by the job.
 */

export interface BulkForm {
  priceMode: "set" | "percent" | "amount"
  stockMode: "set" | "add" | "remove"
  direction: "up" | "down"
  /** The number as typed ("1.250,50", "15"). */
  value: string
  status: "published" | "draft"
  categoryMode: "add" | "remove" | "primary"
  categoryId: string
  seoTitle: boolean
  seoDescription: boolean
}

export const EMPTY_BULK_FORM: BulkForm = {
  priceMode: "set",
  stockMode: "set",
  direction: "up",
  value: "",
  status: "published",
  categoryMode: "add",
  categoryId: "",
  seoTitle: true,
  seoDescription: false,
}

const MAX_AMOUNT = 1_000_000_000
const MAX_QUANTITY = 1_000_000_000
const MAX_RISE_PERCENT = 1000
const MAX_FALL_PERCENT = 99

/** The change, or the i18n key of what is wrong with the form. */
export type BulkFormResult = { change: BulkChange } | { error: string }

function priceChange(form: BulkForm): BulkFormResult {
  if (form.priceMode === "set") {
    const value = parseMoneyInput(form.value)
    return value !== null && value > 0 && value <= MAX_AMOUNT
      ? { change: { action: "price", mode: "set", value } }
      : { error: "products.bulk.errors.price" }
  }
  const value = parseDecimalInput(form.value, 2)
  const sign = form.direction === "up" ? 1 : -1
  if (form.priceMode === "percent") {
    const max = form.direction === "up" ? MAX_RISE_PERCENT : MAX_FALL_PERCENT
    return value !== null && value > 0 && value <= max
      ? { change: { action: "price", mode: "percent", value: sign * value } }
      : {
          error:
            form.direction === "up" ? "products.bulk.errors.rise" : "products.bulk.errors.fall",
        }
  }
  return value !== null && value > 0 && value <= MAX_AMOUNT
    ? { change: { action: "price", mode: "amount", value: sign * value } }
    : { error: "products.bulk.errors.price" }
}

function stockChange(form: BulkForm): BulkFormResult {
  const value = parseCountInput(form.value)
  const set = form.stockMode === "set"
  if (value === null || value > MAX_QUANTITY || (!set && value === 0)) {
    return { error: set ? "products.bulk.errors.quantity" : "products.bulk.errors.adjust" }
  }
  return set
    ? { change: { action: "stock", mode: "set", value } }
    : {
        change: {
          action: "stock",
          mode: "adjust",
          value: form.stockMode === "add" ? value : -value,
        },
      }
}

export function bulkChangeOf(action: BulkAction, form: BulkForm): BulkFormResult {
  switch (action) {
    case "price":
      return priceChange(form)
    case "stock":
      return stockChange(form)
    case "status":
      return { change: { action: "status", status: form.status } }
    case "category":
      return form.categoryId
        ? { change: { action: "category", mode: form.categoryMode, category_id: form.categoryId } }
        : { error: "products.bulk.errors.category" }
    case "seo_template": {
      const fields = [
        ...(form.seoTitle ? (["seo_title"] as const) : []),
        ...(form.seoDescription ? (["seo_description"] as const) : []),
      ]
      return fields.length > 0
        ? { change: { action: "seo_template", fields } }
        : { error: "products.bulk.errors.seoFields" }
    }
    case "alt_text":
      return { change: { action: "alt_text" } }
  }
}

/** What a price change does to an example price, as the server rounds it (to the kuruş). */
export function examplePrice(change: BulkChange, example: number): number | null {
  if (change.action !== "price") {
    return null
  }
  const next =
    change.mode === "set"
      ? change.value
      : change.mode === "percent"
        ? example * (1 + change.value / 100)
        : example + change.value
  return Math.sign(next) * (Math.round((Math.abs(next) + Number.EPSILON) * 100) / 100)
}
