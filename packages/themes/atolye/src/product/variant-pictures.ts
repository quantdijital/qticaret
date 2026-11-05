/**
 * A variant's pictures in the gallery (owner 2026-11-05: "choosing
 * another colour only marks the choice, its photo does not show"): the
 * buy form says which variant was chosen with a window event, the
 * gallery listens. Chosen, a variant with pictures of its own shows them
 * first, the pictures tied to no variant after them; the pictures of the
 * other variants step aside. One with none of its own keeps what shows.
 */
export const VARIANT_CHOSEN_EVENT = "gf:variant-chosen"

/** Tells the gallery the shopper chose this variant. */
export function announceVariant(variantId: string): void {
  window.dispatchEvent(new CustomEvent(VARIANT_CHOSEN_EVENT, { detail: { variantId } }))
}

/** The variant a `gf:variant-chosen` event names; "" for another event. */
export const chosenVariant = (event: Event): string =>
  event instanceof CustomEvent &&
  typeof (event.detail as { variantId?: unknown } | null)?.variantId === "string"
    ? (event.detail as { variantId: string }).variantId
    : ""

/**
 * The places of the pictures to show, in order: every picture in the
 * product's order with no variant (or one with none of its own); the
 * variant's own first, then the ones tied to no variant.
 */
export function pictureOrder(
  count: number,
  own: Readonly<Record<string, readonly number[]>>,
  variantId: string | null
): number[] {
  const all = Array.from({ length: count }, (_, place) => place)
  const mine = (variantId ? (own[variantId] ?? []) : []).filter((place) => place < count)
  if (mine.length === 0) {
    return all
  }
  const tied = new Set(Object.values(own).flat())
  return [...mine, ...all.filter((place) => !tied.has(place))]
}

/** An option's radio pressed on the value already chosen (`option_<id>`): no change fires for it. */
export function pressedAgain(target: EventTarget, chosen: Readonly<Record<string, string>>) {
  const { name, value } = target as { name?: unknown; value?: unknown }
  return (
    typeof name === "string" &&
    name.startsWith("option_") &&
    chosen[name.slice("option_".length)] === value
  )
}
