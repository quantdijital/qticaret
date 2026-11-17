import { useQuery } from "@tanstack/react-query"
import {
  AppWindow,
  BadgeCheck,
  CreditCard,
  Image,
  Mail,
  Menu,
  Phone,
  Share2,
  Store,
  Type,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { FooterBlockType } from "@qticaret/types"
import type { TFunction } from "i18next"
import type { FooterBlock, FooterRow, LayoutDocument } from "@/features/storefront/api/layout"
import { menusQuery } from "@/features/storefront/api/menus"
import { FR } from "./footer-rows-fields"

/** Each block type's small drawing in the tree and the "Blok ekle" list. */
export const BLOCK_ICONS: Readonly<Record<FooterBlockType, LucideIcon>> = {
  text: Type,
  menu: Menu,
  brand: Store,
  newsletter: Mail,
  contact: Phone,
  social: Share2,
  payments: CreditCard,
  image: Image,
  app_badges: AppWindow,
  trust: BadgeCheck,
}

/**
 * The footer menus' names in their order (slot 1 the first): the draft's
 * pending menu set when it carries one (what the preview shows, adr/0063
 * §3), else the shop's menus. Null while they load.
 */
export function useFooterMenus(doc: LayoutDocument): readonly string[] | null {
  const pending = doc.settings.menus
  const saved = useQuery({ ...menusQuery(), enabled: pending === null })
  const list = pending ?? saved.data
  return list ? footerTitles(list) : null
}

/** The footer menus' titles in their order. */
export const footerTitles = (
  menus: readonly { title: string; location: string; rank: number }[]
): string[] =>
  menus
    .filter((menu) => menu.location === "footer")
    .sort((a, b) => a.rank - b.rank)
    .map((menu) => menu.title)

/** A row's name in the tree: "Satır 2 · 3 sütun". */
export const rowName = (t: TFunction, row: FooterRow, index: number) =>
  t(`${FR}.tree.row`, { place: index + 1, count: row.columns.length })

/** A column's name: "Sütun 1", "Sütun 1 · geniş" where its share is the row's widest. */
export function columnName(t: TFunction, row: FooterRow, index: number): string {
  const shares = row.layout.split("-").map(Number)
  const wide = (shares[index] ?? 1) > Math.min(...shares)
  return t(wide ? `${FR}.tree.columnWide` : `${FR}.tree.column`, { place: index + 1 })
}

/** A block's name and its short detail (its own title, the menu it shows, its picture's words). */
export function blockName(
  t: TFunction,
  block: FooterBlock,
  menus: readonly string[] | null
): { name: string; detail: string | null } {
  const name = t(`${FR}.types.${block.type}.name`)
  if (block.type === "menu") {
    const menu = menus?.[block.slot - 1]
    return {
      name: block.title ?? menu ?? name,
      detail: t(`${FR}.tree.slot`, { slot: block.slot }),
    }
  }
  if (block.type === "image") {
    return { name, detail: block.image?.alt ?? null }
  }
  return "title" in block && block.title
    ? { name: block.title, detail: name }
    : { name, detail: null }
}
