import type { StoreMenu, StoreMenuLink } from "@qticaret/types"
import type { FooterGroupView, LinkView, NavCategoryView, Translate } from "@qticaret/ui"
import { isLegalKind, legalPath } from "./legal"

/** The storefront's own pages a menu names (adr/0049): their addresses are the storefront's. */
const SYSTEM_PATHS: Readonly<Record<string, string>> = {
  home: "/",
  shop: "/magaza",
  blog: "/blog",
  reviews: "/yorumlar",
  cart: "/sepet",
  account: "/hesap",
  order_lookup: "/siparis",
}

/**
 * A menu link as the theme prints it: a record's live path or the address
 * from the backend, a storefront page's or legal text's address from here,
 * a storefront page's name in the storefront's words. Without both a name
 * and an address, no link.
 */
export function menuLink(link: StoreMenuLink, t: Translate): LinkView | null {
  const target = link.target ?? ""
  const path =
    link.path ??
    (link.kind === "system"
      ? SYSTEM_PATHS[target]
      : link.kind === "legal" && isLegalKind(target)
        ? legalPath(target)
        : undefined)
  const label = link.label ?? (link.kind === "system" ? t(`menu.system.${target}`) : null)
  return path && label ? { label, path } : null
}

export const menuLinks = (links: readonly StoreMenuLink[], t: Translate): LinkView[] =>
  links.flatMap((link) => {
    const view = menuLink(link, t)
    return view ? [view] : []
  })

const menuAt = (menus: readonly StoreMenu[], location: StoreMenu["location"]) =>
  menus.find((menu) => menu.location === location)

/** The header's menu with its panels; null when the shop made none (the category tree shows). */
export function mainMenu(menus: readonly StoreMenu[], t: Translate): NavCategoryView[] | null {
  const main = menuAt(menus, "main")
  if (!main || main.items.length === 0) {
    return null
  }
  return main.items.flatMap((item) => {
    const view = menuLink(item, t)
    return view ? [{ ...view, children: menuLinks(item.children, t) }] : []
  })
}

/** The small links above the header. */
export const topLinks = (menus: readonly StoreMenu[], t: Translate): LinkView[] =>
  menuLinks(menuAt(menus, "top")?.items ?? [], t)

/** The footer's columns in their order; a column left with no link is not shown. */
export const footerMenus = (menus: readonly StoreMenu[], t: Translate): FooterGroupView[] =>
  menus
    .filter((menu) => menu.location === "footer")
    .sort((a, b) => a.rank - b.rank)
    .flatMap((menu) => {
      const links = menuLinks(menu.items, t)
      return links.length > 0 ? [{ title: menu.title, links }] : []
    })
