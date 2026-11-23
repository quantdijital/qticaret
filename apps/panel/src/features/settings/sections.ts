import {
  Bell,
  Construction,
  CreditCard,
  FileClock,
  FileText,
  Gauge,
  Import,
  KeyRound,
  ListChecks,
  Megaphone,
  Scale,
  Palette,
  Plug,
  Search,
  Sparkles,
  ShieldCheck,
  Store,
  ToggleRight,
  Truck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Capability } from "@/features/auth/api/staff"

export interface SettingsSection {
  key: string
  to: string
  icon: LucideIcon
  /** Offered only to a role that may (adr/0040); the API refuses the others anyway. */
  needs?: Capability
  /** Pages of the section that live under another path (an SMS provider's page). */
  also?: readonly string[]
}

export interface SettingsGroup {
  key: string
  sections: readonly SettingsSection[]
}

/**
 * Settings by what they are about (the shop, selling and delivery, talking
 * to customers, the system), so the list reads as a few groups, not one
 * long row. A subject's parts are tabs of one page (the owner, 2026-10-31):
 * accounting sits with invoices, warehouses with shipping, SMS with e-mail. Each key names its text: `settings.groups.*`, `settings.sections.*`.
 */
export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    key: "shop",
    sections: [
      { key: "store", to: "/settings/store", icon: Store, needs: "settings" },
      // adr/0053: everyone sees whether the storefront is dark; only the owner turns it
      { key: "maintenance", to: "/settings/maintenance", icon: Construction },
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
      // F8 and F11.5: invoices and the accountant's side, in tabs (the owner, 2026-10-31)
      { key: "einvoice", to: "/settings/einvoice", icon: FileText, needs: "settings" },
      // Carriers, options, returns and warehouses, in tabs
      { key: "shipping", to: "/settings/shipping", icon: Truck, needs: "settings" },
    ],
  },
  {
    key: "messages",
    sections: [
      // E-mail and SMS together, in tabs
      {
        key: "notifications",
        to: "/settings/notifications",
        icon: Bell,
        needs: "settings",
        also: ["/settings/sms"],
      },
      { key: "marketing", to: "/settings/marketing", icon: Megaphone, needs: "settings" },
    ],
  },
  {
    key: "system",
    sections: [
      // adr/0061 Ek C14: the package, limits and payment; owner and admin (the API's own rule)
      { key: "subscription", to: "/settings/subscription", icon: Gauge, needs: "settings" },
      // One's own account, the team (a tab for those who may see it) and fraud, in tabs
      // (the owner, 2026-11-23: Ekip joined Güvenlik)
      { key: "security", to: "/settings/security", icon: ShieldCheck },
      { key: "integrations", to: "/settings/integrations", icon: Plug, needs: "settings" },
      // adr/0071 §13: the AI services and their use; the owner connects, the admin tests and reads
      { key: "ai", to: "/settings/ai", icon: Sparkles, needs: "settings" },
      { key: "api", to: "/settings/api", icon: KeyRound, needs: "keys" },
      { key: "features", to: "/settings/features", icon: ToggleRight, needs: "settings" },
      // F14: moving the shop in from its old platform, the owner's alone
      { key: "migration", to: "/settings/migration", icon: Import, needs: "migration" },
      // The audit log and the long jobs, in tabs (the owner, 2026-11-23): everyone has their
      // jobs there, the log is a tab only for those who may read it
      { key: "audit", to: "/settings/audit", icon: FileClock },
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
  [section.to, ...(section.also ?? [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )

/** The group the page at `pathname` belongs to; none on the settings home. */
export const groupOf = (pathname: string): SettingsGroup | undefined =>
  SETTINGS_GROUPS.find((group) => group.sections.some((section) => inSection(pathname, section)))
