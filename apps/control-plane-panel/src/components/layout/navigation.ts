import {
  Bot,
  Coins,
  CreditCard,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Package,
  ScrollText,
  Store,
  UserRound,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { StaffRole } from "@/features/auth/api"

export interface NavItem {
  /** `nav.<key>` in the locale files. */
  key: string
  icon: LucideIcon
  /** Its page; none for a section still to come (shown, not reachable). */
  to?:
    | "/"
    | "/tenants"
    | "/packages"
    | "/payments"
    | "/ai-orders"
    | "/ai-settings"
    | "/releases"
    | "/staff"
    | "/audit-log"
    | "/keys"
    | "/account"
  /** Who sees it; everyone when not set. The API decides again (route table). */
  roles?: readonly StaffRole[]
}

export interface NavGroup {
  /** `nav.groups.<key>`; the first group has no title. */
  key: string | null
  items: NavItem[]
}

const OWNER = ["owner"] as const

/**
 * The control plane's menu (adr/0061 §8): the dashboard; the platform's
 * shops, packages (C7), payments (C16) and releases (C18); the staff,
 * the audit log and the keys (C8) for owners. One's own account sits at
 * the foot of the menu. An item without a page (none today) would be
 * shown but not reachable.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  { key: null, items: [{ key: "dashboard", icon: LayoutDashboard, to: "/" }] },
  {
    key: "platform",
    items: [
      { key: "shops", icon: Store, to: "/tenants" },
      { key: "packages", icon: Package, to: "/packages" },
      { key: "payments", icon: CreditCard, to: "/payments" },
      // adr/0085 K11: the top-up requests, the owner's alone
      { key: "aiOrders", icon: Coins, to: "/ai-orders", roles: OWNER },
      { key: "releases", icon: GitBranch, to: "/releases" },
    ],
  },
  {
    key: "admin",
    items: [
      { key: "staff", icon: Users, to: "/staff", roles: OWNER },
      { key: "audit", icon: ScrollText, to: "/audit-log", roles: OWNER },
      { key: "keys", icon: KeyRound, to: "/keys", roles: OWNER },
      { key: "aiSettings", icon: Bot, to: "/ai-settings", roles: OWNER },
    ],
  },
]

export const ACCOUNT_ITEM: NavItem = { key: "account", icon: UserRound, to: "/account" }

/** The groups a role sees, empty ones left out. */
export function navFor(role: StaffRole | null | undefined): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || (role ? item.roles.includes(role) : false)),
  })).filter((group) => group.items.length > 0)
}

/** The item a path belongs to: the longest page that starts it. */
export function activeKey(pathname: string): string | undefined {
  const items = [...NAV_GROUPS.flatMap((group) => group.items), ACCOUNT_ITEM]
  return items
    .filter(
      (item) => item.to && (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to))
    )
    .sort((a, b) => (b.to?.length ?? 0) - (a.to?.length ?? 0))[0]?.key
}
