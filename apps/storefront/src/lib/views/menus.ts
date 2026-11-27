import type { StoreImage, StoreMenu, StoreMenuLink } from "@qticaret/types"
import type {
  CategoryCardView,
  FooterGroupView,
  LinkView,
  NavCategoryView,
  NavChildView,
  Translate,
} from "@qticaret/ui"
import { categoryCard } from "./card-extras"
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
  categories: "/kategoriler",
  brands: "/markalar",
  sale: "/kampanyalar",
}

/**
 * A menu link as the theme prints it: a record's live path or the address
 * from the backend, a storefront page's or legal text's address from here,
 * a storefront page's name in the storefront's words. Without both a name
 * and an address, no link. The backend checks a menu's addresses when it
 * is saved; the storefront checks them again before printing one: only a
 * path of its own (`/…`, not `//…`) or a secure address (`https://…`).
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
  return path && label && isSafeHref(path) ? { label, path } : null
}

const OWN_PATH = /^\/(?![/\\])/
const SECURE_ADDRESS = /^https:\/\/[^\s/\\]/i

/** A path of the storefront's own or a secure address; never `//host`, `\`, a script or a blank. */
export const isSafeHref = (href: string): boolean =>
  !/[\s\\]/.test(href) && (OWN_PATH.test(href) || SECURE_ADDRESS.test(href))

export const menuLinks = (links: readonly StoreMenuLink[], t: Translate): LinkView[] =>
  links.flatMap((link) => {
    const view = menuLink(link, t)
    return view ? [view] : []
  })

const menuAt = (menus: readonly StoreMenu[], location: StoreMenu["location"]) =>
  menus.find((menu) => menu.location === location)

/**
 * The header's menu with its panels; null when the shop made none (the
 * category tree shows). A link to a category, at the top or below it,
 * carries its picture when it has one (adr/0046 Ek 2026-11-04).
 */
export function mainMenu(
  menus: readonly StoreMenu[],
  t: Translate,
  pictures: ReadonlyMap<string, StoreImage> = new Map(),
  subcategories: (categoryId: string) => LinkView[] = () => []
): NavCategoryView[] | null {
  const main = menuAt(menus, "main")
  if (!main || main.items.length === 0) {
    return null
  }
  const card = (link: StoreMenuLink): CategoryCardView[] => {
    const view = menuLink(link, t)
    const picture = link.kind === "category" && link.target ? pictures.get(link.target) : null
    return view ? [categoryCard(view, picture)] : []
  }
  // A child's own links for the wide panel: its menu children, else its category's children
  const child = (link: StoreMenuLink): NavChildView[] =>
    card(link).map((view) => {
      const own = menuLinks(link.children, t)
      const links =
        own.length > 0
          ? own
          : link.kind === "category" && link.target
            ? subcategories(link.target)
            : []
      return links.length > 0 ? { ...view, links } : view
    })
  return main.items.flatMap((item) =>
    card(item).map((view) => ({ ...view, children: item.children.flatMap(child) }))
  )
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
