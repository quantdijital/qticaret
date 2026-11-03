import type { StoreAddonSelection, StoreProductAddon } from "@qticaret/types"

/**
 * A shopper's add-on picks read from a form (adr/0052): each add-on's field
 * is `addon_<id>`, the text typed or the choice's id; empty is none. Only
 * the picks are sent, never a price (CLAUDE.md rule 5). The checks here
 * spare a round trip that would add and take back a line; the backend
 * checks every pick again and alone prices them.
 */

/** The form field of an add-on (ids are `[a-z0-9_-]`, the backend's). */
export const addonField = (id: string): string => `addon_${id}`

// The backend's character sets (lib/catalog/addons/text.ts), on NFC text
const CHARSETS: Record<string, RegExp> = {
  letters_digits: /^[\p{L}\p{N} ]+$/u,
  text: /^[\p{L}\p{N} .,'&-]+$/u,
}

/** The text as the backend keeps it: NFC, one line, single spaces, trimmed. */
export const plainAddonText = (text: string): string =>
  text.normalize("NFC").replace(/\s+/gu, " ").trim()

export type Picks = { ok: true; selections: StoreAddonSelection[] } | { ok: false; error: string }

/** The picks for the product's add-ons, in its order; a refusal's message key otherwise. */
export function selectionsOf(
  addons: readonly StoreProductAddon[],
  read: (name: string) => string | null
): Picks {
  const selections: StoreAddonSelection[] = []
  for (const addon of addons) {
    const raw = read(addonField(addon.id)) ?? ""
    if (addon.kind === "text") {
      const value = plainAddonText(raw)
      if (value === "") {
        if (addon.required) {
          return { ok: false, error: "addons.required" }
        }
        continue
      }
      if (value.length > addon.text.max_length) {
        return { ok: false, error: "addons.text_too_long" }
      }
      if (!(CHARSETS[addon.text.charset] ?? CHARSETS["letters_digits"])?.test(value)) {
        return { ok: false, error: "addons.charset" }
      }
      selections.push({ addon_id: addon.id, value })
      continue
    }
    if (raw === "") {
      if (addon.required) {
        return { ok: false, error: "addons.required" }
      }
      continue
    }
    if (!addon.choices.some((choice) => choice.id === raw)) {
      return { ok: false, error: "addons.unknown" }
    }
    selections.push({ addon_id: addon.id, choice_id: raw })
  }
  return { ok: true, selections }
}

/** The fewest units the picked add-ons allow on one line; null: no limit of theirs. */
export function pickedLimit(
  addons: readonly StoreProductAddon[],
  selections: readonly StoreAddonSelection[]
): number | null {
  const picked = new Set(selections.map((selection) => selection.addon_id))
  const limits = addons.flatMap((addon) =>
    picked.has(addon.id) && addon.max_quantity !== null ? [addon.max_quantity] : []
  )
  return limits.length === 0 ? null : Math.min(...limits)
}

/** Whether a form carries any add-on pick at all (to tell "none chosen" from "none offered"). */
export const hasPicks = (form: FormData): boolean =>
  [...form.entries()].some(
    ([name, value]) => name.startsWith("addon_") && typeof value === "string" && value.trim() !== ""
  )

/** A form's text field, or null. */
export const fieldOf =
  (form: FormData) =>
  (name: string): string | null => {
    const value = form.get(name)
    return typeof value === "string" ? value : null
  }
