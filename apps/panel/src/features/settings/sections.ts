import {
  Bell,
  CreditCard,
  FileClock,
  ListChecks,
  ListTodo,
  Megaphone,
  MessageSquare,
  Palette,
  Plug,
  Search,
  Store,
  ToggleRight,
  Truck,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface SettingsSection {
  key: string
  to: string
  icon: LucideIcon
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
      { key: "store", to: "/settings/store", icon: Store },
      { key: "appearance", to: "/settings/appearance", icon: Palette },
      { key: "seo", to: "/settings/seo", icon: Search },
      { key: "attributes", to: "/settings/attributes", icon: ListChecks },
    ],
  },
  {
    key: "selling",
    sections: [
      { key: "payments", to: "/settings/payments", icon: CreditCard },
      { key: "shipping", to: "/settings/shipping", icon: Truck },
      { key: "locations", to: "/settings/locations", icon: Warehouse },
      { key: "marketing", to: "/settings/marketing", icon: Megaphone },
    ],
  },
  {
    key: "messages",
    sections: [
      { key: "notifications", to: "/settings/notifications", icon: Bell },
      { key: "sms", to: "/settings/sms", icon: MessageSquare },
    ],
  },
  {
    key: "system",
    sections: [
      { key: "integrations", to: "/settings/integrations", icon: Plug },
      { key: "features", to: "/settings/features", icon: ToggleRight },
      { key: "jobs", to: "/settings/jobs", icon: ListTodo },
      { key: "audit", to: "/settings/audit", icon: FileClock },
    ],
  },
]

/** Whether the page at `pathname` belongs to the section. */
export const inSection = (pathname: string, section: SettingsSection): boolean =>
  pathname === section.to || pathname.startsWith(`${section.to}/`)

/** The group the page at `pathname` belongs to; none on the settings home. */
export const groupOf = (pathname: string): SettingsGroup | undefined =>
  SETTINGS_GROUPS.find((group) => group.sections.some((section) => inSection(pathname, section)))
