import type { MenuInput } from "../menus"
import type { PresetLink, SkippedRef } from "./resolve"

/**
 * A preset's menus resolved for this shop (adr/0063 §4), the shop's live
 * menus kept where the preset leaves a place empty. The set replaces every
 * menu of the shop at the publication (§3), so a place the set leaves out
 * would lose its menu: a menu of the preset whose every link is gone, or a
 * place the preset writes no menu for, carries the shop's live menu there
 * as it is, and "Yayınla" leaves it as it was. A set of only the shop's
 * own menus is none ("leave the menus alone").
 */

export interface PresetMenuInput {
  title: string
  location: string
  items: {
    label: string
    href: string
    children?: { label: string; href: string }[] | undefined
  }[]
}

const LOCATIONS = ["main", "top", "footer"] as const

export function resolveMenus(
  menus: readonly PresetMenuInput[],
  links: ReadonlyMap<string, PresetLink | null>,
  live: readonly MenuInput[],
  skipped: SkippedRef[]
): unknown[] | null {
  const lost: SkippedRef[] = []
  const resolved = menus.flatMap((menu, rank) => {
    const where = `menus.${menu.location}`
    const link = (each: { label: string; href: string }) => {
      const found = links.get(each.href)
      if (!found) {
        skipped.push({ where, ref: each.href })
        return null
      }
      return { ...found, label: each.label }
    }
    const items = menu.items.flatMap((item) => {
      const parent = link(item)
      if (!parent) {
        return []
      }
      const children = (item.children ?? []).flatMap((child) => {
        const found = link(child)
        return found ? [found] : []
      })
      return [{ link: parent, children }]
    })
    if (items.length === 0 && menu.items.length > 0) {
      // Put live empty, it would take the shop's menu away for nothing
      lost.push({ where: "menus", ref: menu.location })
      return []
    }
    return [{ title: menu.title, location: menu.location, rank, items }]
  })
  const hasLive = (location: string) => live.some((menu) => menu.location === location)
  skipped.push(...lost.map((each) => ({ ...each, kept_live: hasLive(each.ref) })))
  if (resolved.length === 0) {
    return null
  }
  const kept = LOCATIONS.filter(
    (location) => !resolved.some((menu) => menu.location === location)
  ).flatMap((location) => live.filter((menu) => menu.location === location))
  return [...resolved, ...kept]
}
