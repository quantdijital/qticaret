import {
  BadgePercent,
  ChartColumnBig,
  FileText,
  FolderTree,
  Images,
  LayoutDashboard,
  Link2,
  ListTree,
  Mails,
  MessageSquareText,
  Package,
  Paintbrush,
  Search,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  Users,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Capability } from "@/features/auth/api/staff"

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

export const NAV_GROUPS: NavGroup[] = [
  {
    key: null,
    items: [{ key: "dashboard", to: "/", icon: LayoutDashboard, exact: true }],
  },
  {
    key: "sales",
    items: [
      { key: "orders", to: "/orders", icon: ShoppingBag },
      // adr/0051: orders staff make for a customer, paid through a link, while the shop has them on
      {
        key: "paymentLinks",
        to: "/payment-links",
        icon: Link2,
        feature: "orders.payment_links",
        needs: "paymentLinks",
      },
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
    // What the shop's customers see around its catalog (adr/0049); the editor opens full screen
    key: "storefront",
    items: [
      { key: "themeEditor", to: "/storefront/editor", icon: Paintbrush },
      { key: "menus", to: "/storefront/menus", icon: ListTree },
      { key: "content", to: "/content", icon: FileText },
      // Every picture the shop uploaded; the pickers of every image field open it too
      { key: "media", to: "/media", icon: Images },
      { key: "storefrontPreferences", to: "/storefront/preferences", icon: SlidersHorizontal },
    ],
  },
  {
    key: "growth",
    items: [
      { key: "promotions", to: "/promotions", icon: BadgePercent },
      // adr/0050: bulk e-mail and SMS, the owner's and admin's, while the shop has it on
      {
        key: "bulkMessages",
        to: "/bulk-messages",
        icon: Mails,
        feature: "marketing.campaigns",
        needs: "bulkMessages",
      },
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
