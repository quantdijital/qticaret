import { formatLira } from "@qticaret/ui"
import type { AddonFieldView, AddonFormView, LineAddonView, Translate } from "@qticaret/ui"
import type { StoreLineAddon, StoreLineAddons, StoreProductAddon } from "@qticaret/types"

/**
 * Product add-ons in words (adr/0052): a product's add-ons as form fields,
 * and what a cart or order line records of its picks (`metadata.qt_addons`,
 * the server's). Prices come formatted; their kuruş only feed the product
 * page's running total.
 */

const kurus = (lira: number): number => Math.round(lira * 100)

/** "+35,00 TL"; null for a free pick. */
const plus = (lira: number): string | null =>
  Number.isFinite(lira) && kurus(lira) > 0 ? `+${formatLira(lira)}` : null

/** A product's add-ons as its page's (and a cart line's) form fields. */
export function addonFieldsOf(
  addons: readonly StoreProductAddon[],
  t: Translate
): AddonFieldView[] {
  return addons.map((addon) => {
    const common = {
      id: addon.id,
      kind: addon.kind,
      label: addon.label,
      help: addon.help,
      required: addon.required,
      maxQuantity: addon.max_quantity,
      nonWithdrawable: addon.non_withdrawable,
    }
    return addon.kind === "text"
      ? {
          ...common,
          price: plus(addon.price),
          kurus: Math.max(0, kurus(addon.price)),
          maxLength: addon.text.max_length,
          rules: t(`addons.rules_${addon.text.charset === "text" ? "text" : "letters_digits"}`, {
            max: addon.text.max_length,
          }),
          choices: [],
        }
      : {
          ...common,
          price: null,
          kurus: 0,
          maxLength: null,
          rules: null,
          choices: addon.choices.map((choice) => ({
            id: choice.id,
            label: choice.label,
            price: plus(choice.price),
            kurus: Math.max(0, kurus(choice.price)),
          })),
        }
  })
}

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.length <= 400 ? value : undefined

function itemOf(value: unknown): StoreLineAddon[] {
  if (!isRow(value) || typeof value["label"] !== "string") {
    return []
  }
  const typed = text(value["value"])
  const choiceId = text(value["choice_id"])
  const choiceLabel = text(value["choice_label"])
  return [
    {
      addon_id: typeof value["addon_id"] === "string" ? value["addon_id"] : "",
      kind: value["kind"] === "choice" ? "choice" : "text",
      label: value["label"],
      ...(typed === undefined ? {} : { value: typed }),
      ...(choiceId === undefined ? {} : { choice_id: choiceId }),
      ...(choiceLabel === undefined ? {} : { choice_label: choiceLabel }),
      amount: typeof value["amount"] === "number" ? value["amount"] : 0,
      non_withdrawable: value["non_withdrawable"] === true,
    },
  ]
}

/** A line's `metadata.qt_addons`, read as the backend writes it; null for a line without picks. */
export function lineAddonsRecord(metadata: unknown): StoreLineAddons | null {
  const record = isRow(metadata) ? metadata["qt_addons"] : undefined
  if (!isRow(record) || !Array.isArray(record["items"])) {
    return null
  }
  const items = record["items"].flatMap(itemOf)
  const limit = record["max_quantity"]
  return {
    items,
    base: typeof record["base"] === "number" ? record["base"] : 0,
    non_withdrawable:
      record["non_withdrawable"] === true || items.some((item) => item.non_withdrawable),
    max_quantity: typeof limit === "number" && Number.isInteger(limit) && limit > 0 ? limit : null,
  }
}

export interface LineAddons {
  addons: LineAddonView[]
  nonWithdrawable: boolean
  /** The most units the line may hold with its picks; null: no limit of theirs. */
  maxQuantity: number | null
}

const NONE: LineAddons = { addons: [], nonWithdrawable: false, maxQuantity: null }

/** What a line says of its picks: "Ürün üzerine yazı: Ahmet (+35,00 TL)", one each. */
export function lineAddonsOf(metadata: unknown): LineAddons {
  const record = lineAddonsRecord(metadata)
  if (!record) {
    return NONE
  }
  return {
    addons: record.items.map((item) => ({
      label: item.label,
      value: (item.kind === "choice" ? item.choice_label : item.value) ?? null,
      amount: plus(item.amount),
      nonWithdrawable: item.non_withdrawable,
    })),
    nonWithdrawable: record.non_withdrawable,
    maxQuantity: record.max_quantity,
  }
}

/**
 * A cart line's picks form: the product's add-ons as fields, filled with
 * what the line carries. Null for a product without add-ons (or while the
 * shop has them off: its add-ons read as none).
 */
export function addonFormOf(
  productId: string,
  addons: readonly StoreProductAddon[],
  metadata: unknown,
  t: Translate
): AddonFormView | null {
  if (addons.length === 0) {
    return null
  }
  const record = lineAddonsRecord(metadata)
  const values = Object.fromEntries(
    (record?.items ?? []).flatMap((item) => {
      const value = item.kind === "choice" ? item.choice_id : item.value
      return item.addon_id && value ? [[item.addon_id, value]] : []
    })
  )
  return {
    productId,
    fields: addonFieldsOf(addons, t),
    values,
    missingRequired: addons.some((addon) => addon.required && !values[addon.id]),
    removable: record !== null && record.items.length > 0 && !addons.some((a) => a.required),
  }
}
