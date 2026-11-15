import type {
  CategoryMainVariant,
  FooterBarVariant,
  HeaderBarVariant,
  ProductMainVariant,
  SectionLook,
} from "@qticaret/types"
import type { FooterBarFields } from "@/features/storefront/api/layout-cards"

/**
 * The main sections (adr/0049 Ek 2026-11-14 §5, §7): the shop's header
 * bar, its footer, the product's own block and the category's product
 * grid. One to a group, always shown (never hidden, scheduled, copied or
 * removed); the server reads each into a design saved before them, so the
 * editor always finds them. The product's block and the category grid take
 * a look; the header's bar and the footer do not.
 */
interface MainBase {
  id: string
  visible: true
  starts_at: null
  ends_at: null
}

export interface HeaderBarSection extends MainBase {
  type: "header_bar"
  variant: HeaderBarVariant
  /** The header stays at the top of a long page (the theme's `header.sticky` before). */
  sticky: boolean
}

/** The footer, with its own settings (adr/0049 Ek 2026-11-15). */
export interface FooterBarSection extends MainBase, FooterBarFields {
  type: "footer_bar"
  variant: FooterBarVariant
}

export interface ProductMainSection extends MainBase {
  type: "product_main"
  variant: ProductMainVariant
  look?: SectionLook
}

export interface CategoryMainSection extends MainBase {
  type: "category_main"
  variant: CategoryMainVariant
  /** Each variant's own settings (§7, one object a variant); none so far. */
  by_variant: Record<string, never>
  look?: SectionLook
}

export type MainSection =
  HeaderBarSection | FooterBarSection | ProductMainSection | CategoryMainSection

export type MainSectionType = MainSection["type"]
