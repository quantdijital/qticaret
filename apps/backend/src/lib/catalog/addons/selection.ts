import { addKurus, fromMedusaAmount, sumKurus } from "../../money"
import type { Kurus, MedusaAmount } from "../../money"
import type { StoredAddon } from "./schema"
import { addonTextProblem, plainAddonText } from "./text"

/**
 * A cart line's add-ons (adr/0052 §1): the shopper names them, the server
 * prices them from the product's add-ons as they are now. Every add-on
 * goes on each unit of the line: its price is per unit, and the line's
 * unit price is the variant's plus theirs. Pure, so tested on its own.
 */

/** What the storefront sends for one add-on: the text typed, or the choice picked. */
export interface AddonSelection {
  addon_id: string
  value?: string | undefined
  choice_id?: string | undefined
}

/** One chosen add-on as the line keeps it: what was sold, at what price per unit. */
export interface ChosenAddon {
  addon_id: string
  kind: "text" | "choice"
  label: string
  /** The typed text (a text add-on). */
  value?: string
  choice_id?: string
  choice_label?: string
  /** Per unit, in lira as Medusa keeps amounts. */
  amount: number
  non_withdrawable: boolean
}

export interface SelectionProblem {
  key: string
  field: string
}

const liraToKurus = (amount: number): Kurus => fromMedusaAmount(amount, { allowRounding: true })

/**
 * The selections priced against the product's add-ons, in the product's
 * order (two lines with the same picks then read the same), or why not:
 * an add-on or choice the product lacks, one named twice, a text that
 * breaks its add-on's rules.
 */
export function chooseAddons(
  addons: readonly StoredAddon[],
  selections: readonly AddonSelection[]
): { chosen: ChosenAddon[] } | { problem: SelectionProblem } {
  const byId = new Map(addons.map((addon) => [addon.id, addon]))
  const picked = new Map<string, ChosenAddon>()
  for (const [index, selection] of selections.entries()) {
    const field = `selections.${String(index)}`
    const addon = byId.get(selection.addon_id)
    if (!addon) {
      return { problem: { key: "addons.unknown", field: `${field}.addon_id` } }
    }
    if (picked.has(addon.id)) {
      return { problem: { key: "addons.duplicate", field: `${field}.addon_id` } }
    }
    const base = {
      addon_id: addon.id,
      label: addon.label,
      non_withdrawable: addon.non_withdrawable,
    }
    if (addon.kind === "text") {
      if (selection.choice_id !== undefined || typeof selection.value !== "string") {
        return { problem: { key: "addons.text_required", field: `${field}.value` } }
      }
      const value = plainAddonText(selection.value)
      const problem = addonTextProblem(value, addon.text)
      if (problem) {
        return { problem: { key: problem, field: `${field}.value` } }
      }
      picked.set(addon.id, { ...base, kind: "text", value, amount: addon.price })
    } else {
      const choice = addon.choices.find((each) => each.id === selection.choice_id)
      if (selection.value !== undefined || !choice) {
        return { problem: { key: "addons.unknown", field: `${field}.choice_id` } }
      }
      picked.set(addon.id, {
        ...base,
        kind: "choice",
        choice_id: choice.id,
        choice_label: choice.label,
        amount: choice.price,
      })
    }
  }
  return {
    chosen: addons.flatMap((addon) => {
      const chosen = picked.get(addon.id)
      return chosen ? [chosen] : []
    }),
  }
}

/**
 * Why a line with these picks cannot be sold, or null: a required add-on
 * left out, or more units than an add-on allows on one line.
 */
export function lineAddonProblem(
  addons: readonly StoredAddon[],
  chosen: readonly ChosenAddon[],
  quantity: number
): SelectionProblem | null {
  const ids = new Set(chosen.map((each) => each.addon_id))
  if (addons.some((addon) => addon.required && !ids.has(addon.id))) {
    return { key: "addons.required", field: "selections" }
  }
  const limit = maxQuantityOf(addons, chosen)
  return limit !== null && quantity > limit
    ? { key: "addons.max_quantity", field: "quantity" }
    : null
}

/** The fewest units any chosen add-on allows on a line; null: no limit. */
export function maxQuantityOf(
  addons: readonly StoredAddon[],
  chosen: readonly ChosenAddon[]
): number | null {
  const limits = addons
    .filter((addon) => chosen.some((each) => each.addon_id === addon.id))
    .flatMap((addon) => (addon.max_quantity === null ? [] : [addon.max_quantity]))
  return limits.length === 0 ? null : Math.min(...limits)
}

/** The line's unit price in kuruş: the variant's, plus each chosen add-on's. */
export const addonUnitPrice = (base: Kurus, chosen: readonly ChosenAddon[]): Kurus =>
  addKurus(base, sumKurus(chosen.map((each) => liraToKurus(each.amount))))

/**
 * A line charges other than its add-ons cost now (adr/0052 §5): its unit
 * price is not the expected one, or Medusa would price it itself (not a
 * custom price), which drops the add-ons from the price.
 */
export const isStalePrice = (
  line: { unit_price: MedusaAmount; is_custom_price?: boolean | null },
  expected: Kurus
): boolean =>
  line.is_custom_price !== true ||
  fromMedusaAmount(line.unit_price, { allowRounding: true }) !== expected
