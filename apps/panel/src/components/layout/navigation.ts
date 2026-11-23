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
  Search,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Users,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Capability } from "@/features/auth/api/staff"
import { COLLECTIONS_FLAG } from "@/features/collections/paths"
import { WHOLESALE_FLAG } from "@/features/wholesale/api/types"

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
    items: [
      { key: "dashboard", to: "/", icon: LayoutDashboard, exact: true },
      { key: "reports", to: "/reports", icon: ChartColumnBig },
    ],
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
      // ADR-0068: the wholesalers, their levels and orders, apart from the retail customers
      // (the owner, 2026-11-16), for owner and admin while the shop sells wholesale
      {
        key: "wholesale",
        to: "/wholesale",
        icon: Store,
        feature: WHOLESALE_FLAG,
        needs: "wholesale",
      },
    ],
  },
  {
    // What the shop sells and has on hand (the owner, 2026-11-23: each thing under its kind)
    key: "catalog",
    items: [
      { key: "products", to: "/products", icon: Package },
      { key: "categories", to: "/categories", icon: FolderTree },
      { key: "brands", to: "/brands", icon: Tag },
      // While the shop has collections on (on by default; Ayarlar > Özellikler)
      { key: "collections", to: "/collections", icon: Layers, feature: COLLECTIONS_FLAG },
      { key: "inventory", to: "/inventory", icon: Warehouse },
    ],
  },
  {
    // How the storefront looks (adr/0049); the editor opens full screen
    key: "storefront",
    items: [
      // The storefront's preferences are a panel of it (the owner, 2026-11-16)
      { key: "themeEditor", to: "/storefront/editor", icon: Paintbrush },
      // Ready-made and saved looks into the draft (adr/0064)
      { key: "looks", to: "/storefront/looks", icon: LayoutTemplate },
      { key: "menus", to: "/storefront/menus", icon: ListTree },
    ],
  },
  {
    // What the shop writes and uploads (the owner, 2026-11-23)
    key: "content",
    items: [
      // The shop's own pages, found here and written in the theme editor (adr/0073 Ek not 2026-11-20)
      { key: "pages", to: "/storefront/pages", icon: Files },
      // The blog: its posts, categories, tags and authors, and the filter pages
      { key: "content", to: "/content", icon: FileText },
      // Every picture the shop uploaded; the pickers of every image field open it too
      { key: "media", to: "/media", icon: Images },
    ],
  },
  {
    // Bringing customers in and back (the owner, 2026-11-23: "Büyüme" became "Pazarlama")
    key: "marketing",
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
      { key: "reviews", to: "/reviews", icon: MessageSquareText },
      { key: "seo", to: "/seo", icon: Search },
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
