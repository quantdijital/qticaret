import type { AddonFieldView } from "@qticaret/ui"

/**
 * The product page's running total of its add-on picks (adr/0052): what
 * it shows only. The line's price is the server's, once it is added.
 */

/** A form's add-on picks, by add-on id (`addon_<id>` fields; empty is none). */
export function picksOf(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries(
    [...new FormData(form).entries()].flatMap(([name, value]) =>
      name.startsWith("addon_") && typeof value === "string" ? [[name.slice(6), value]] : []
    )
  )
}

const picked = (field: AddonFieldView, picks: Record<string, string>): boolean =>
  (picks[field.id] ?? "").trim() !== ""

/** What the picks add to one unit, in kuruş: only for the running total, the server prices the line. */
export function picksKurus(fields: readonly AddonFieldView[], picks: Record<string, string>) {
  return fields.reduce((sum, field) => {
    if (!picked(field, picks)) {
      return sum
    }
    if (field.kind === "text") {
      return sum + field.kurus
    }
    return sum + (field.choices.find((choice) => choice.id === picks[field.id])?.kurus ?? 0)
  }, 0)
}

/** The fewest units the picked add-ons allow on one line; null: no limit of theirs. */
export function picksLimit(
  fields: readonly AddonFieldView[],
  picks: Record<string, string>
): number | null {
  const limits = fields.flatMap((field) =>
    picked(field, picks) && field.maxQuantity !== null ? [field.maxQuantity] : []
  )
  return limits.length === 0 ? null : Math.min(...limits)
}
