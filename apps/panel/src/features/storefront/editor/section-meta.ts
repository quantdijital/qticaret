import type { TFunction } from "i18next"
import {
  AppWindow,
  BadgeCheck,
  BookOpen,
  Boxes,
  CircleHelp,
  Columns3,
  Contact,
  CreditCard,
  FileText,
  GalleryHorizontal,
  GalleryHorizontalEnd,
  LayoutGrid,
  LifeBuoy,
  Mail,
  Megaphone,
  MoveHorizontal,
  MessageSquareQuote,
  Package,
  PanelBottom,
  PanelTop,
  ScanSearch,
  ShoppingBag,
  Star,
  Tags,
  Text,
  Truck,
  Wallet,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { AnySection, BodySectionType, MainSectionType } from "@/features/storefront/api/layout"

/**
 * What a section is called: `storefront.editor.types.<type>` (the footer's
 * box is its own, so is a content page's text, adr/0073 Ek 2026-11-19 (2) K2).
 */
export type SectionKind =
  BodySectionType | MainSectionType | "announcement_bar" | "footer_newsletter" | "article"

export const SECTION_ICONS: Readonly<Record<SectionKind, LucideIcon>> = {
  announcement_bar: Megaphone,
  hero: PanelTop,
  hero_slider: GalleryHorizontalEnd,
  banner: GalleryHorizontal,
  strip_gallery: Columns3,
  categories: LayoutGrid,
  products: ShoppingBag,
  featured_product: ScanSearch,
  brands: Tags,
  posts: BookOpen,
  reviews: MessageSquareQuote,
  google_rating: Star,
  rich_text: Text,
  article: FileText,
  contact: Contact,
  payment_facts: CreditCard,
  shipping_facts: Truck,
  faq: CircleHelp,
  related_products: Boxes,
  trust_badges: BadgeCheck,
  newsletter: Mail,
  help: LifeBuoy,
  marquee: MoveHorizontal,
  price_bands: Wallet,
  footer_newsletter: Mail,
  header_bar: AppWindow,
  footer_bar: PanelBottom,
  product_main: Package,
  category_main: LayoutGrid,
}

/** The section's kind; the newsletter box is the footer's when it sits there, a page's text its own. */
export const kindOf = (section: AnySection, inFooter = false): SectionKind =>
  inFooter && section.type === "newsletter"
    ? "footer_newsletter"
    : section.type === "rich_text" && section.variant === "article"
      ? "article"
      : section.type

/** The title the shop gave it, if the type has one. */
function ownTitle(section: AnySection): string | null {
  switch (section.type) {
    case "hero":
      return section.heading
    case "banner":
    case "hero_slider":
      return section.slides[0]?.heading ?? null
    case "categories":
    case "products":
    case "featured_product":
    case "brands":
    case "posts":
    case "reviews":
    case "google_rating":
    case "rich_text":
    case "faq":
    case "related_products":
    case "newsletter":
    case "help":
    case "price_bands":
    case "strip_gallery":
      return section.title
    case "announcement_bar":
      return section.lines.find((line) => line.trim() !== "") ?? null
    case "marquee":
      return section.items.find((item) => item.text.trim() !== "")?.text ?? null
    case "trust_badges":
    case "contact":
    case "payment_facts":
    case "shipping_facts":
    case "header_bar":
    case "footer_bar":
    case "product_main":
    case "category_main":
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
