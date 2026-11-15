import type { QuickViewView } from "../quick-view-views"

/**
 * A card's quick view in the browser (adr/0049 Ek 2026-11-15), shared by
 * every theme: the storefront's answer for one product, asked when the
 * dialog opens, kept for a minute so a second look asks nothing.
 * No React here; the address is the storefront's own (the layout's
 * `quickView.address`), never the backend's (adr/0046 §5).
 */

/** What came back: the product, none (404: no longer sold), or a failure. */
export type QuickViewAnswer =
  { status: "ready"; view: QuickViewView } | { status: "missing" } | { status: "error" }

const isView = (value: unknown): value is QuickViewView =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as QuickViewView).id === "string" &&
  typeof (value as QuickViewView).path === "string" &&
  Array.isArray((value as QuickViewView).variants) &&
  Array.isArray((value as QuickViewView).images)

/** The address for one product: `{address}?id=<product id>`. */
export const quickViewUrl = (address: string, productId: string): string =>
  `${address}?${new URLSearchParams({ id: productId }).toString()}`

/** How long an answer is kept: a second look soon after asks nothing, a price never goes stale for long. */
export const QUICK_VIEW_KEPT_MS = 60_000

// The answers by product, each with the time it lapses (a price is the shopper's: a signed-in
// customer's group prices differ, so a sign-in or sign-out forgets them all)
const kept = new Map<string, { view: QuickViewView; until: number }>()

/** Forgets the kept answers (a sign-in or sign-out; a test's fresh page). */
export function forgetQuickViews(): void {
  kept.clear()
}

/** The product's quick view: kept, or asked; never throws. */
export async function loadQuickView(
  address: string,
  productId: string,
  signal?: AbortSignal
): Promise<QuickViewAnswer> {
  const known = kept.get(productId)
  if (known && known.until > Date.now()) {
    return { status: "ready", view: known.view }
  }
  kept.delete(productId)
  try {
    const response = await fetch(quickViewUrl(address, productId), {
      ...(signal ? { signal } : {}),
      headers: { accept: "application/json" },
      credentials: "same-origin",
    })
    if (response.status === 404) {
      return { status: "missing" }
    }
    const body: unknown = response.ok ? await response.json() : null
    if (!isView(body)) {
      return { status: "error" }
    }
    kept.set(productId, { view: body, until: Date.now() + QUICK_VIEW_KEPT_MS })
    return { status: "ready", view: body }
  } catch {
    return { status: "error" }
  }
}
