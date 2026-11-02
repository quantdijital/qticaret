import {
  BadgePercent,
  ChartColumnBig,
  FileText,
  FolderTree,
  LayoutDashboard,
  ListTree,
  MessageSquareText,
  Package,
  Search,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  Users,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * The panel's map (docs/06 ekran planı): one place for the sidebar, the
 * command menu and the top bar's title.
 */

export interface NavItem {
  key: string
  to: string
  icon: LucideIcon
  /** Only this path, not its children. */
  exact?: boolean
}

export interface NavGroup {
  /** No label for the first group. */
  key: string | null
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: null,
    items: [{ key: "dashboard", to: "/", icon: LayoutDashboard, exact: true }],
  },
  {
    key: "sales",
    items: [
      { key: "orders", to: "/orders", icon: ShoppingBag },
      { key: "customers", to: "/customers", icon: Users },
    ],
  },
  {
    key: "catalog",
    items: [
      { key: "products", to: "/products", icon: Package },
      { key: "categories", to: "/categories", icon: FolderTree },
      { key: "brands", to: "/brands", icon: Tag },
      { key: "inventory", to: "/inventory", icon: Warehouse },
      { key: "reviews", to: "/reviews", icon: MessageSquareText },
    ],
  },
  {
    // What the shop's customers see around its catalog (adr/0049); the theme editor joins later
    key: "storefront",
    items: [
      { key: "menus", to: "/storefront/menus", icon: ListTree },
      { key: "content", to: "/content", icon: FileText },
      { key: "storefrontSettings", to: "/settings/storefront", icon: SlidersHorizontal },
    ],
  },
  {
    key: "growth",
    items: [
      { key: "promotions", to: "/promotions", icon: BadgePercent },
      { key: "seo", to: "/seo", icon: Search },
      { key: "reports", to: "/reports", icon: ChartColumnBig },
    ],
  },
]

export const SETTINGS_ITEM: NavItem = { key: "settings", to: "/settings", icon: Settings }

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
 * specific one, so Storefront settings (`/settings/storefront`) wins over
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
