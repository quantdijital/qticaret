import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { HandleKind } from "@qticaret/sector-packs"
import { MENU_LIMITS, isShopPath } from "../../lib/storefront/menus"
import type { MenuInput, MenuLinkInput } from "../../lib/storefront/menus"
import type { PresetLink, PresetLookups } from "../../lib/storefront/presets/resolve"
import { linkFromHref } from "./menu-hrefs"
import { existingRecords, isRecordKind } from "./menu-links"
import { adminMenus } from "./menus-read"
import type { AdminMenuLink } from "./menus-read"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What a preset's references point at in this shop (adr/0063 §4), read
 * once before the pure walk (`resolvePreset`). A record by its URL handle,
 * live or not: a category the pack made hidden (`is_active: false`) is
 * found, and its section shows once the shop opens it, as the storefront
 * filters it today. A page is a content page, never a post.
 */

const ENTITY: Readonly<Record<HandleKind, string>> = {
  category: "product_category",
  product: "product",
  collection: "product_collection",
  brand: "brand",
  page: "content_entry",
}

/** `category:cakilar` → the record's id; a handle with no record is absent. */
export async function recordsByHandle(
  container: Container,
  refs: Iterable<string>
): Promise<Map<string, string>> {
  const byKind = new Map<HandleKind, string[]>()
  for (const ref of refs) {
    const [kind, handle] = ref.split(":") as [HandleKind, string]
    if (Object.hasOwn(ENTITY, kind) && handle) {
      byKind.set(kind, [...(byKind.get(kind) ?? []), handle])
    }
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const found = new Map<string, string>()
  for (const [kind, handles] of byKind) {
    const { data } = await query.graph({
      entity: ENTITY[kind],
      fields: ["id", "handle", ...(kind === "page" ? ["kind"] : [])],
      filters: { handle: handles },
    })
    for (const row of data as { id: string; handle: string; kind?: string }[]) {
      if (kind !== "page" || row.kind === "page") {
        found.set(`${kind}:${row.handle}`, row.id)
      }
    }
  }
  return found
}

/**
 * Each address as a link (`linkFromHref`): a storefront page by its name, a
 * record's live path by the record, an https address as written. A path
 * on the shop nothing answers is null: the link is left out, not kept as
 * a dead address.
 */
export async function linksByHref(
  container: Container,
  hrefs: Iterable<string>
): Promise<Map<string, PresetLink | null>> {
  const found = new Map<string, PresetLink | null>()
  for (const href of hrefs) {
    const link: PresetLink & { label?: unknown } = await linkFromHref(container, {
      label: null,
      href,
    })
    delete link.label
    found.set(href, link.kind === "url" && isShopPath(href.trim()) ? null : link)
  }
  return found
}

/** The records and links a preset names; its images are added once in the library. */
export async function presetLookups(
  container: Container,
  markers: { handles: Iterable<string>; hrefs: Iterable<string> },
  images: ReadonlyMap<string, string>
): Promise<PresetLookups> {
  const [records, links] = await Promise.all([
    recordsByHandle(container, markers.handles),
    linksByHref(container, markers.hrefs),
  ])
  return { records, links, images }
}

/** A stored link as a set writes it. */
const inputOf = (item: AdminMenuLink): MenuLinkInput =>
  item.kind === "url"
    ? {
        kind: "url",
        url: item.url ?? "",
        label: item.label ?? (item.url ?? "").slice(0, MENU_LIMITS.label),
      }
    : ({ kind: item.kind, target: item.target ?? "", label: item.label } as MenuLinkInput)

/**
 * The shop's menus now, as a menu set writes them (adr/0063 §4): what a
 * preset keeps where it leaves a place, put back live as it is. Read with
 * the Menüler screen's own reader; a link whose record no longer exists is
 * left out (the storefront shows none, and a set naming it is refused).
 */
export async function liveMenus(container: Container): Promise<MenuInput[]> {
  const menus = await adminMenus(container)
  const found = await existingRecords(
    container,
    menus.flatMap((menu) => menu.items.flatMap((item) => [item, ...item.children]))
  )
  const alive = (item: AdminMenuLink) =>
    !isRecordKind(item.kind) || found.has(`${item.kind}:${item.target ?? ""}`)
  return menus.map((menu) => ({
    title: menu.title,
    location: menu.location,
    rank: menu.rank,
    items: menu.items.filter(alive).map((item) => ({
      link: inputOf(item),
      children: item.children.filter(alive).map(inputOf),
    })),
  }))
}
