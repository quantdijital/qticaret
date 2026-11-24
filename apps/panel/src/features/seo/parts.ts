import {
  ArrowRightLeft,
  Globe,
  LayoutDashboard,
  Lightbulb,
  Link2,
  ScanSearch,
  Search,
  TextCursorInput,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Capability } from "@/features/auth/api/staff"

/**
 * Settings > SEO's tabs (`/settings/seo?part=`), the shop's one SEO home
 * (the owner, 2026-11-23: "SEO işleri buradan yürümeli"): the daily work
 * first, then the shop's SEO settings, which only a role that may change
 * settings sees (adr/0040; the API refuses the others anyway).
 */
export const SEO_PARTS = [
  "overview",
  "advisor",
  "audit",
  "redirects",
  "site-search",
  "addresses",
  "pages",
  "search",
] as const
export type SeoPart = (typeof SEO_PARTS)[number]

export interface SeoPartItem {
  part: SeoPart
  /** Its name: `settings.seo.tabs.<label>`. */
  label: string
  icon: LucideIcon
  needs?: Capability
}

export const SEO_PART_ITEMS: readonly SeoPartItem[] = [
  { part: "overview", label: "overview", icon: LayoutDashboard },
  { part: "advisor", label: "advisor", icon: Lightbulb },
  { part: "audit", label: "audit", icon: ScanSearch },
  { part: "redirects", label: "redirects", icon: ArrowRightLeft },
  { part: "site-search", label: "siteSearch", icon: Search },
  { part: "addresses", label: "addresses", icon: Link2, needs: "settings" },
  { part: "pages", label: "pages", icon: TextCursorInput, needs: "settings" },
  { part: "search", label: "search", icon: Globe, needs: "settings" },
]

/** The parts a role sees, in order. */
export const visibleSeoParts = (can: (capability: Capability) => boolean) =>
  SEO_PART_ITEMS.filter((item) => !item.needs || can(item.needs))
