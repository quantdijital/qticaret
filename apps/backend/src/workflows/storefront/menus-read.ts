import type { MedusaContainer } from "@medusajs/framework/types"
import { STOREFRONT_MENUS_MODULE } from "../../modules/storefront-menus"
import type StorefrontMenusModuleService from "../../modules/storefront-menus/service"
import type { MenuLinkKind, MenuLocation } from "../../modules/storefront-menus/service"
import { resolveLinks } from "./menu-links"
import type { ResolvedLink, StoredLink } from "./menu-links"

type Container = Pick<MedusaContainer, "resolve">

const LOCATION_ORDER: Readonly<Record<MenuLocation, number>> = { main: 0, top: 1, footer: 2 }

/** A link as the panel shows it: what it points at, what it shows now, and whether it is broken. */
export interface AdminMenuLink extends ResolvedLink {
  id: string
  kind: MenuLinkKind
  target: string | null
  url: string | null
  label: string | null
  children: AdminMenuLink[]
}

/** A link as the storefront prints it; a broken one is not there. */
export interface StoreMenuLink {
  /** The shop's wording, else the record's or legal text's name; null: the storefront's own name. */
  label: string | null
  kind: MenuLinkKind
  target: string | null
  /** The record's live path or the address; null: the storefront's own page or a legal text. */
  path: string | null
  children: StoreMenuLink[]
}

interface MenuRow {
  id: string
  title: string
  location: MenuLocation
  rank: number
}

async function rowsOf(container: Container) {
  const service = container.resolve<StorefrontMenusModuleService>(STOREFRONT_MENUS_MODULE)
  const menus = (await service.listStorefrontMenus(
    {},
    { select: ["id", "title", "location", "rank"] }
  )) as MenuRow[]
  const items = (await service.listStorefrontMenuItems(
    { menu_id: menus.map((menu) => menu.id) },
    { select: ["id", "menu_id", "parent_id", "rank", "label", "kind", "target", "url"] }
  )) as (StoredLink & { menu_id: string })[]
  menus.sort((a, b) => LOCATION_ORDER[a.location] - LOCATION_ORDER[b.location] || a.rank - b.rank)
  items.sort((a, b) => a.rank - b.rank)
  // Each menu's links under their parent, in one pass (security review 2026-11-02, L1)
  const under = new Map<string, StoredLink[]>()
  for (const item of items) {
    const key = `${item.menu_id}|${item.parent_id ?? ""}`
    under.set(key, [...(under.get(key) ?? []), item])
  }
  const childrenOf = (menuId: string, parentId: string | null): StoredLink[] =>
    under.get(`${menuId}|${parentId ?? ""}`) ?? []
  return { menus, childrenOf, resolved: await resolveLinks(container, items) }
}

const BROKEN: ResolvedLink = { name: null, path: null, broken: true }

/** Every menu with every link, each marked with what it shows now (adr/0049): the panel's view. */
export async function adminMenus(container: Container) {
  const { menus, childrenOf, resolved } = await rowsOf(container)
  const linkOf =
    (menuId: string) =>
    (item: StoredLink): AdminMenuLink => ({
      id: item.id,
      kind: item.kind,
      target: item.target,
      url: item.url,
      label: item.label,
      ...(resolved.get(item.id) ?? BROKEN),
      children: childrenOf(menuId, item.id).map(linkOf(menuId)),
    })
  return menus.map((menu) => ({ ...menu, items: childrenOf(menu.id, null).map(linkOf(menu.id)) }))
}

/**
 * The menus as the storefront prints them (adr/0049): a link whose record
 * is gone or not live, or whose legal text is not published, is left out,
 * and so are its children.
 */
export async function storeMenus(container: Container) {
  const { menus, childrenOf, resolved } = await rowsOf(container)
  const linksOf = (menuId: string, parentId: string | null): StoreMenuLink[] =>
    childrenOf(menuId, parentId).flatMap((item) => {
      const shown = resolved.get(item.id) ?? BROKEN
      return shown.broken
        ? []
        : [
            {
              label: item.label ?? shown.name,
              kind: item.kind,
              target: item.target,
              path: shown.path,
              children: linksOf(menuId, item.id),
            },
          ]
    })
  // A menu left without a link is not there at all
  return menus.flatMap((menu) => {
    const items = linksOf(menu.id, null)
    return items.length > 0
      ? [{ title: menu.title, location: menu.location, rank: menu.rank, items }]
      : []
  })
}
