import type { TFunction } from "i18next"
import {
  BadgeCheck,
  BookOpen,
  GalleryHorizontal,
  LayoutGrid,
  LifeBuoy,
  Mail,
  Megaphone,
  MessageSquareQuote,
  PanelTop,
  ShoppingBag,
  Tags,
  Text,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { AnySection, HomeSectionType } from "@/features/storefront/api/layout"

/** What a section is called: `storefront.editor.types.<type>` (the footer's box is its own). */
export type SectionKind = HomeSectionType | "announcement_bar" | "footer_newsletter"

export const SECTION_ICONS: Readonly<Record<SectionKind, LucideIcon>> = {
  announcement_bar: Megaphone,
  hero: PanelTop,
  banner: GalleryHorizontal,
  categories: LayoutGrid,
  products: ShoppingBag,
  brands: Tags,
  posts: BookOpen,
  reviews: MessageSquareQuote,
  rich_text: Text,
  trust_badges: BadgeCheck,
  newsletter: Mail,
  help: LifeBuoy,
  footer_newsletter: Mail,
}

/** The section's kind; the newsletter box is the footer's when it sits there. */
export const kindOf = (section: AnySection, inFooter = false): SectionKind =>
  inFooter && section.type === "newsletter" ? "footer_newsletter" : section.type

/** The title the shop gave it, if the type has one. */
function ownTitle(section: AnySection): string | null {
  switch (section.type) {
    case "hero":
      return section.heading
    case "banner":
      return section.slides[0]?.heading ?? null
    case "categories":
    case "products":
    case "brands":
    case "posts":
    case "reviews":
    case "rich_text":
    case "newsletter":
    case "help":
      return section.title
    case "announcement_bar":
      return section.lines.find((line) => line.trim() !== "") ?? null
    case "trust_badges":
      return null
  }
}

/** The row's name and, under it, its type when the name is the shop's own. */
export function sectionLabel(
  t: TFunction,
  section: AnySection,
  inFooter = false
): { name: string; detail: string | null } {
  const type = t(`storefront.editor.types.${kindOf(section, inFooter)}.name`)
  const own = ownTitle(section)?.trim()
  return own ? { name: own, detail: type } : { name: type, detail: null }
}
