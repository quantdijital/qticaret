import {
  BadgePercent,
  ChartColumnBig,
  FileText,
  FolderTree,
  LayoutDashboard,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Tag,
  Users,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * The panel's map (docs/06 ekran planı): one place for the sidebar, the
 * command menu and the top bar's title. `advanced` is where the job lives
 * in Medusa Admin until its panel screen ships (adr/0022 §3).
 */

export interface NavItem {
  key: string
  to: string
  icon: LucideIcon
  /** Only this path, not its children. */
  exact?: boolean
  advanced: string
}

export interface NavGroup {
  /** No label for the first group. */
  key: string | null
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: null,
    items: [{ key: "dashboard", to: "/", icon: LayoutDashboard, exact: true, advanced: "/" }],
  },
  {
    key: "sales",
    items: [
      { key: "orders", to: "/orders", icon: ShoppingBag, advanced: "/orders" },
      { key: "customers", to: "/customers", icon: Users, advanced: "/customers" },
    ],
  },
  {
    key: "catalog",
    items: [
      { key: "products", to: "/products", icon: Package, advanced: "/products" },
      { key: "categories", to: "/categories", icon: FolderTree, advanced: "/categories" },
      { key: "brands", to: "/brands", icon: Tag, advanced: "/products" },
      { key: "inventory", to: "/inventory", icon: Warehouse, advanced: "/inventory" },
    ],
  },
  {
    key: "growth",
    items: [
      { key: "promotions", to: "/promotions", icon: BadgePercent, advanced: "/promotions" },
      { key: "seo", to: "/seo", icon: Search, advanced: "/settings/seo" },
      { key: "content", to: "/content", icon: FileText, advanced: "/" },
      { key: "reports", to: "/reports", icon: ChartColumnBig, advanced: "/" },
    ],
  },
]

export const SETTINGS_ITEM: NavItem = {
  key: "settings",
  to: "/settings",
  icon: Settings,
  advanced: "/settings",
}

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_ITEM,
]

export function isActive(item: NavItem, pathname: string): boolean {
  return item.exact
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`)
}

/** The item a path belongs to, for titles and the command menu. */
export function itemFor(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => isActive(item, pathname))
}

/** A menu item by key, for routes that render from the map. */
export function navItem(key: string): NavItem {
  const item = ALL_NAV_ITEMS.find((candidate) => candidate.key === key)
  if (!item) {
    throw new Error(`no menu item "${key}"`)
  }
  return item
}
