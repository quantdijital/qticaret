import type { AddonSelection, ChosenAddon } from "./selection"

/**
 * The add-ons a line carries (adr/0052 §1), kept in its `metadata.qt_addons`
 * (the server alone writes `qt_` keys): a copy of what was chosen as it
 * was priced, so the order still knows what it sold once the product's
 * add-ons change. It travels from the cart line to the order line.
 */

export const ADDONS_KEY = "qt_addons"

/** What the KVKK erasure leaves of a typed text (adr/0052 §10). */
export const ERASED_TEXT = "—"

export interface LineAddons {
  items: ChosenAddon[]
  /** The variant's unit price the add-ons were added to, in lira. */
  base: number
  /** A chosen add-on makes the line outside the right of withdrawal. */
  non_withdrawable: boolean
  /** The most units the line may hold with them; null: no limit. */
  max_quantity: number | null
}

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

function itemOf(value: unknown): ChosenAddon[] {
  if (
    !isRow(value) ||
    typeof value["addon_id"] !== "string" ||
    typeof value["label"] !== "string"
  ) {
    return []
  }
  const kind = value["kind"] === "choice" ? "choice" : "text"
  const value_ = text(value["value"])
  const choiceId = text(value["choice_id"])
  const choiceLabel = text(value["choice_label"])
  return [
    {
      addon_id: value["addon_id"],
      kind,
      label: value["label"],
      ...(value_ === undefined ? {} : { value: value_ }),
      ...(choiceId === undefined ? {} : { choice_id: choiceId }),
      ...(choiceLabel === undefined ? {} : { choice_label: choiceLabel }),
      amount: typeof value["amount"] === "number" ? value["amount"] : 0,
      non_withdrawable: value["non_withdrawable"] === true,
    },
  ]
}

/** The add-ons a line's metadata records; null for a line without any. */
export function lineAddonsOf(metadata: unknown): LineAddons | null {
  const addons = isRow(metadata) ? metadata[ADDONS_KEY] : undefined
  if (!isRow(addons) || !Array.isArray(addons["items"])) {
    return null
  }
  const items = addons["items"].flatMap(itemOf)
  return {
    items,
    base: typeof addons["base"] === "number" ? addons["base"] : 0,
    non_withdrawable:
      addons["non_withdrawable"] === true || items.some((item) => item.non_withdrawable),
    max_quantity: typeof addons["max_quantity"] === "number" ? addons["max_quantity"] : null,
  }
}

/** The record a line keeps of its add-ons. */
export function lineAddons(
  chosen: readonly ChosenAddon[],
  base: number,
  maxQuantity: number | null
): LineAddons {
  return {
    items: [...chosen],
    base,
    non_withdrawable: chosen.some((each) => each.non_withdrawable),
    max_quantity: maxQuantity,
  }
}

/** The line's add-ons as picks again, to price them anew. */
export const selectionsOf = (addons: LineAddons): AddonSelection[] =>
  addons.items.map((item) =>
    item.kind === "text"
      ? { addon_id: item.addon_id, value: item.value ?? "" }
      : { addon_id: item.addon_id, choice_id: item.choice_id ?? "" }
  )

/** Outside the right of withdrawal through an add-on (adr/0052 §8): faulty or wrong only. */
export const isNonWithdrawableLine = (metadata: unknown): boolean =>
  lineAddonsOf(metadata)?.non_withdrawable === true

/**
 * What an invoice line says of its add-ons (adr/0052 §9): the add-on's
 * name, and a choice's; never the typed text, which can be a person's
 * name and an invoice is kept for ten years.
 */
export const addonInvoiceParts = (metadata: unknown): string[] =>
  (lineAddonsOf(metadata)?.items ?? []).map((item) =>
    item.kind === "choice" && item.choice_label ? `${item.label}: ${item.choice_label}` : item.label
  )

/**
 * A line's metadata with its typed texts gone (KVKK erasure, adr/0052 §10):
 * the add-on's name and price stay for the books; null when there was
 * nothing to erase.
 */
export function withoutAddonTexts(metadata: unknown): Row | null {
  if (!isRow(metadata)) {
    return null
  }
  const addons = metadata[ADDONS_KEY]
  if (!isRow(addons) || !Array.isArray(addons["items"])) {
    return null
  }
  const items = addons["items"] as unknown[]
  const typed = items.some(
    (item) => isRow(item) && typeof item["value"] === "string" && item["value"] !== ERASED_TEXT
  )
  if (!typed) {
    return null
  }
  return {
    ...metadata,
    [ADDONS_KEY]: {
      ...addons,
      items: items.map((item) =>
        isRow(item) && typeof item["value"] === "string" ? { ...item, value: ERASED_TEXT } : item
      ),
    },
  }
}
