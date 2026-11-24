import type {
  CategoryMainVariant,
  FooterBarVariant,
  FooterColumnsStep,
  HeaderBarVariant,
  HeaderMenuGround,
  HeaderMenuImages,
  HeaderSearchStyle,
  HeaderSearchWidth,
  HeaderToolsPlace,
  HeaderTopLinksPlace,
  ProductImageRatio,
  ProductMainVariant,
  SectionLook,
} from "@qticaret/types"
import type { FooterBarFields } from "@/features/storefront/api/layout-cards"
import type { FooterRowsFields } from "./layout-footer-rows"
import type { LayoutLink } from "./layout-sections"

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

interface HeaderBarCommon extends MainBase {
  type: "header_bar"
  /** The header stays at the top of a long page (the theme's `header.sticky` before). */
  sticky: boolean
  /**
   * Where the menus show the categories' pictures (adr/0049 Ek 2026-11-15),
   * on every variant: `all` ("Kategoriler" too), `submenus` (the dropdowns
   * and the phone's menu), `off`; the server reads a bar saved before it
   * as `submenus`.
   */
  menu_images: HeaderMenuImages
  /**
   * How the search stands (adr/0049 Ek 2026-11-15), on every variant: `field`
   * (the box), `icon` (a magnifier that opens it; on a phone the bottom bar's
   * "Ara" drops it down); the server reads a bar saved before it as `field`.
   */
  search_style: HeaderSearchStyle
}

/**
 * The catalog header's own settings (adr/0049 Ek 2026-11-14 N14, Ek
 * 2026-11-15): kept only while the bar is drawn as it.
 */
export interface HeaderCatalogFields {
  /** The search box's words; null: the storefront's. */
  search_placeholder: string | null
  search_label: boolean
  account_text: boolean
  cart_total: boolean
  highlight_link: LayoutLink | null
  utility_bar: boolean
  phone: boolean
  categories_button: boolean
  menu_ground: HeaderMenuGround
  /** Its layout choices (Ek 2026-11-15); the server fills each one a bar was saved without. */
  tools_place: HeaderToolsPlace
  top_links: HeaderTopLinksPlace
  search_width: HeaderSearchWidth
  /** The strip's short note and where it goes (Ek 2026-11-15); null: none. */
  strip_note: string | null
  strip_note_link: LayoutLink | null
}

export type HeaderCatalogSection = HeaderBarCommon & { variant: "catalog" } & HeaderCatalogFields

export type HeaderBarSection =
  (HeaderBarCommon & { variant: Exclude<HeaderBarVariant, "catalog"> }) | HeaderCatalogSection

interface FooterBarCommon extends MainBase, FooterBarFields {
  type: "footer_bar"
}

/**
 * The brand columns footer's own settings (adr/0049 Ek 2026-11-17): kept
 * only while the footer is drawn as it.
 */
export interface FooterColumnsFields {
  top_strip: boolean
  /** A short line under the shop's name; null: none. */
  about: string | null
  ground: FooterColumnsStep<"ground">
  badge_style: FooterColumnsStep<"badge_style">
}

export type FooterColumnsSection = FooterBarCommon & {
  variant: "brand_columns"
} & FooterColumnsFields

/** The free rows footer (adr/0070): its rows of columns of blocks, its ground and marks. */
export type FooterRowsSection = FooterBarCommon & { variant: "free_rows" } & FooterRowsFields

/** The footer, with its own settings (adr/0049 Ek 2026-11-15) and its variant's. */
export type FooterBarSection =
  | (FooterBarCommon & { variant: Exclude<FooterBarVariant, "brand_columns" | "free_rows"> })
  | FooterColumnsSection
  | FooterRowsSection

export interface ProductMainSection extends MainBase {
  type: "product_main"
  variant: ProductMainVariant
  /** The gallery's picture shape; left out: the square. */
  image_ratio?: ProductImageRatio
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
