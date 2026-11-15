import type { QuickViewView } from "../quick-view-views"

/**
 * A card's quick view in the browser (adr/0049 Ek 2026-11-15), shared by
 * every theme: the storefront's answer for one product, asked when the
 * dialog opens, kept for the page's life so a second look asks nothing.
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

// The answers by product, for the page's life (a price is the shopper's: never shared)
const kept = new Map<string, QuickViewView>()

/** Forgets the kept answers (a test's fresh page). */
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
  if (known) {
    return { status: "ready", view: known }
  }
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
    kept.set(productId, body)
    return { status: "ready", view: body }
  } catch {
    return { status: "error" }
  }
}
