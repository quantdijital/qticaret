import type { BottomNavItem, BottomNavView } from "@qticaret/ui"

/**
 * Where the phone's bottom bar stays away (docs/20 "mobil alt gezinme"):
 * the checkout keeps the shopper on paying, a preview is a frame in the
 * panel, and the maintenance link's page has no shop around it.
 */
const WITHOUT_BAR = ["/odeme", "/onizleme", "/bakim"]

/** The bar's items by the paths they lead to, each with what is below it. */
const ITEMS: readonly { item: BottomNavItem; root: string }[] = [
  { item: "categories", root: "/kategoriler" },
  { item: "search", root: "/arama" },
  { item: "cart", root: "/sepet" },
  { item: "account", root: "/hesap" },
]

const under = (path: string, root: string) => path === root || path.startsWith(`${root}/`)

/** An address's path, without its query or fragment. */
export const pathOf = (url: string) => url.split(/[?#]/, 1)[0] ?? ""

/** The bar for the page at `url` (path and query, as the proxy set it); null where it stays away. */
export function bottomNavOf(url: string): BottomNavView | null {
  const path = pathOf(url)
  if (WITHOUT_BAR.some((root) => under(path, root))) {
    return null
  }
  if (path === "/") {
    return { current: "home" }
  }
  return { current: ITEMS.find(({ root }) => under(path, root))?.item ?? null }
}

/**
 * The pages of paying (`/odeme`, its card form, the payment's result):
 * the theme draws them in its focused frame, no search or menus to wander
 * off to (UX denetimi 2026-11-05). The cart and a payment link's own page
 * (`/ode/…`) keep the shop's frame.
 */
export const isCheckoutPage = (url: string): boolean => under(pathOf(url), "/odeme")
