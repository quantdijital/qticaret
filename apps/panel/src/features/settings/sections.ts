import {
  Bell,
  Calculator,
  CreditCard,
  FileClock,
  FileText,
  KeyRound,
  ListChecks,
  ListTodo,
  Megaphone,
  Scale,
  MessageSquare,
  Palette,
  Plug,
  Search,
  ShieldCheck,
  Store,
  ToggleRight,
  Truck,
  Users,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Capability } from "@/features/auth/api/staff"

export interface SettingsSection {
  key: string
  to: string
  icon: LucideIcon
  /** Offered only to a role that may (adr/0040); the API refuses the others anyway. */
  needs?: Capability
}

export interface SettingsGroup {
  key: string
  sections: readonly SettingsSection[]
}

/**
 * Settings by what they are about (the shop, selling and delivery, talking
 * to customers, the system), so the list reads as a few groups, not one
 * long row. Each key names its text: `settings.groups.*`, `settings.sections.*`.
 */
export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    key: "shop",
    sections: [
      { key: "store", to: "/settings/store", icon: Store, needs: "settings" },
      { key: "appearance", to: "/settings/appearance", icon: Palette, needs: "settings" },
      { key: "seo", to: "/settings/seo", icon: Search, needs: "settings" },
      { key: "attributes", to: "/settings/attributes", icon: ListChecks, needs: "settings" },
      // F13.1: the contracts and policies the shop's customers read
      { key: "legal", to: "/settings/legal", icon: Scale, needs: "settings" },
    ],
  },
  {
    key: "selling",
    sections: [
      { key: "payments", to: "/settings/payments", icon: CreditCard, needs: "settings" },
      { key: "accounting", to: "/settings/accounting", icon: Calculator, needs: "settings" },
      // F8: who issues the shop's invoices
      { key: "einvoice", to: "/settings/einvoice", icon: FileText, needs: "settings" },
      { key: "shipping", to: "/settings/shipping", icon: Truck, needs: "settings" },
      { key: "locations", to: "/settings/locations", icon: Warehouse, needs: "settings" },
      { key: "marketing", to: "/settings/marketing", icon: Megaphone, needs: "settings" },
    ],
  },
  {
    key: "messages",
    sections: [
      { key: "notifications", to: "/settings/notifications", icon: Bell, needs: "settings" },
      { key: "sms", to: "/settings/sms", icon: MessageSquare, needs: "settings" },
    ],
  },
  {
    key: "system",
    sections: [
      { key: "security", to: "/settings/security", icon: ShieldCheck },
      { key: "team", to: "/settings/team", icon: Users, needs: "team" },
      { key: "integrations", to: "/settings/integrations", icon: Plug, needs: "settings" },
      { key: "api", to: "/settings/api", icon: KeyRound, needs: "keys" },
      { key: "features", to: "/settings/features", icon: ToggleRight, needs: "settings" },
      { key: "jobs", to: "/settings/jobs", icon: ListTodo },
      { key: "audit", to: "/settings/audit", icon: FileClock, needs: "audit" },
    ],
  },
]

/** The groups with the sections a role is offered; a group left empty goes. */
export function visibleGroups(can: (capability: Capability) => boolean): readonly SettingsGroup[] {
  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter((section) => !section.needs || can(section.needs)),
  })).filter((group) => group.sections.length > 0)
}

/** Whether the page at `pathname` belongs to the section. */
export const inSection = (pathname: string, section: SettingsSection): boolean =>
  pathname === section.to || pathname.startsWith(`${section.to}/`)

/** The group the page at `pathname` belongs to; none on the settings home. */
export const groupOf = (pathname: string): SettingsGroup | undefined =>
  SETTINGS_GROUPS.find((group) => group.sections.some((section) => inSection(pathname, section)))
