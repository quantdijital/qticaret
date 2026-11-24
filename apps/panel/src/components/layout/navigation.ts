import {
  BadgePercent,
  ChartColumnBig,
  FileText,
  Files,
  FolderTree,
  Images,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  ListTree,
  Mails,
  MessageSquareText,
  Package,
  Paintbrush,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Users,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Capability } from "@/features/auth/api/staff"
import { panelScreen } from "@/features/panel-map/map"

/**
 * The panel's menu (docs/06 ekran planı): one place for the sidebar, the
 * command menu and the top bar's title. Each item's path, name and gates
 * come from the panel's map (adr/0079 §4, `@qticaret/types/panel-map`);
 * the menu adds its icon and its place.
 */

export interface NavItem {
  key: string
  to: string
  /** Its name: an i18n key (`nav.orders`). */
  label: string
  icon: LucideIcon
  /** Only this path, not its children. */
  exact?: boolean
  /** Shown only while this tenant flag is on (adr/0012). */
  feature?: string
  /** Shown only to a role that may (adr/0040); the API refuses the others anyway. */
  needs?: Capability
}

export interface NavGroup {
  /** No label for the first group. */
  key: string | null
  items: NavItem[]
}

/** The map's screen `key` as a menu item with its icon. */
function fromMap(key: string, icon: LucideIcon, { exact }: { exact?: true } = {}): NavItem {
  const screen = panelScreen(key)
  return {
    key,
    to: screen.path,
    label: screen.label,
    icon,
    ...(exact ? { exact } : {}),
    ...(screen.feature ? { feature: screen.feature } : {}),
    ...(screen.needs ? { needs: screen.needs } : {}),
  }
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: null,
    items: [
      fromMap("dashboard", LayoutDashboard, { exact: true }),
      fromMap("reports", ChartColumnBig),
    ],
  },
  {
    key: "sales",
    items: [
      fromMap("orders", ShoppingBag),
      // adr/0051: orders staff make for a customer, paid through a link, while the shop has them on
      fromMap("paymentLinks", Link2),
      fromMap("customers", Users),
      // ADR-0068: the wholesalers, their levels and orders, apart from the retail customers
      // (the owner, 2026-11-16), for owner and admin while the shop sells wholesale
      fromMap("wholesale", Store),
    ],
  },
  {
    // What the shop sells and has on hand (the owner, 2026-11-23: each thing under its kind)
    key: "catalog",
    items: [
      fromMap("products", Package),
      fromMap("categories", FolderTree),
      fromMap("brands", Tag),
      // While the shop has collections on (on by default; Ayarlar > Özellikler)
      fromMap("collections", Layers),
      fromMap("inventory", Warehouse),
    ],
  },
  {
    // How the storefront looks (adr/0049); the editor opens full screen
    key: "storefront",
    items: [
      // The storefront's preferences are a panel of it (the owner, 2026-11-16)
      fromMap("themeEditor", Paintbrush),
      // Ready-made and saved looks into the draft (adr/0064): the owner's alone (2026-11-23)
      fromMap("looks", LayoutTemplate),
      fromMap("menus", ListTree),
    ],
  },
  {
    // What the shop writes and uploads (the owner, 2026-11-23)
    key: "content",
    items: [
      // The shop's own pages, found here and written in the theme editor (adr/0073 Ek not 2026-11-20)
      fromMap("pages", Files),
      // The blog: its posts, categories, tags and authors, and the filter pages
      fromMap("content", FileText),
      // Every picture the shop uploaded; the pickers of every image field open it too
      fromMap("media", Images),
    ],
  },
  {
    // Bringing customers in and back (the owner, 2026-11-23: "Büyüme" became "Pazarlama");
    // SEO went to Settings > SEO, its one home (the owner, 2026-11-23)
    key: "marketing",
    items: [
      fromMap("promotions", BadgePercent),
      // adr/0050: bulk e-mail and SMS, the owner's and admin's, while the shop has it on
      fromMap("bulkMessages", Mails),
      fromMap("reviews", MessageSquareText),
    ],
  },
]

export const SETTINGS_ITEM: NavItem = fromMap("settings", Settings)

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_ITEM,
]

export function isActive(item: NavItem, pathname: string): boolean {
  return item.exact
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`)
}

/**
 * The item a path belongs to, for titles and the command menu: the most
 * specific one, so a settings page under its own item would win over
 * Settings.
 */
export function itemFor(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.filter((item) => isActive(item, pathname)).reduce<NavItem | undefined>(
    (best, item) => (best && best.to.length >= item.to.length ? best : item),
    undefined
  )
}

/** A menu item by key, for routes that render from the map. */
export function navItem(key: string): NavItem {
  const item = ALL_NAV_ITEMS.find((candidate) => candidate.key === key)
  if (!item) {
    throw new Error(`no menu item "${key}"`)
  }
  return item
}
