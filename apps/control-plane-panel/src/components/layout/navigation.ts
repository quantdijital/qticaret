import {
  CreditCard,
  GitBranch,
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
  to?: "/" | "/tenants" | "/packages" | "/staff" | "/audit-log" | "/account"
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
 * shops and packages (C7), and the sections still to come (payments C16,
 * releases C18) shown so the shape of the panel is clear, but not
 * reachable until their task builds them; the staff and the audit log for
 * owners. One's own account sits at the foot of the menu.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  { key: null, items: [{ key: "dashboard", icon: LayoutDashboard, to: "/" }] },
  {
    key: "platform",
    items: [
      { key: "shops", icon: Store, to: "/tenants" },
      { key: "packages", icon: Package, to: "/packages" },
      { key: "payments", icon: CreditCard },
      { key: "releases", icon: GitBranch },
    ],
  },
  {
    key: "admin",
    items: [
      { key: "staff", icon: Users, to: "/staff", roles: OWNER },
      { key: "audit", icon: ScrollText, to: "/audit-log", roles: OWNER },
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
