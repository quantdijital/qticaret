/**
 * Section variants (adr/0049 Ek 2026-11-14 §2): how a section type may be
 * drawn, a closed list per type whose first is the drawing from before
 * variants and the default. The contract's list: a new variant goes here
 * first, then into the backend's schema (`lib/storefront/sections/
 * variants.ts`, a mirror a test keeps equal), then into the themes. Names
 * are English, sector-free and say what is drawn; the panel's Turkish
 * names are `storefront.editor.variants.<type>.<variant>`.
 */
export const SECTION_VARIANTS = {
  /**
   * `strip`: today's tinted strip; `lined`: boxes split by hairlines (GB4);
   * `card` (adr/0077 §10 Ek): one white floating box, rules between the
   * badges, lifted over the section before it while `lift` is on.
   */
  trust_badges: ["strip", "lined", "card"],
  /**
   * `standard`: today's graphite opening; `category_list`: the category
   * list, the opening's tile and two category tiles side by side (H17);
   * `full_image` (adr/0077 §9): the photograph as the whole opening.
   */
  hero: ["standard", "category_list", "full_image"],
  /**
   * `tiles`: today's picture tiles; `linked`: each category a card with its
   * first subcategories as links (adr/0049 Ek 2026-11-15); `collage`:
   * photo-led cards filling each row, the first one wider while `lead` is on;
   * `panels` (Ek 2026-11-19): frameless graphite panels led by their photos,
   * the first tall beside the others stacked while `lead` is on; `icons`
   * (adr/0077 §10 Ek): one row of round discs, each an icon over its name;
   * `carousel`: the categories as picture cards in one row that slides (the
   * scroller kit, `section-scroller`).
   */
  categories: ["tiles", "linked", "collage", "panels", "icons", "carousel"],
  /**
   * The product rail (adr/0049 Ek 2026-11-15): `grid`, today's rows of
   * cards; `carousel`, one row that slides (the scroller kit,
   * `section-scroller`); `featured`, one large card beside two rows of
   * three small ones; `compact`, small side-by-side cards three across;
   * `columns`, two or three lists side by side, each its own title and
   * source, in small cards; `strips` (Ek 2026-11-16), each product one
   * upright strip with slanted seams, its name and price over the foot,
   * no card (`SHELF_STRIPS_SETTINGS`); `ranked` (Ek 2026-11-16), a ranked
   * list, each product beside its place in large figures, the first large
   * or all in one row (`SHELF_RANKED_LAYOUTS`); `stage_list` (Ek 2026-11-16), one
   * product large on a stage beside a list of the rail's products, the row
   * under the pointer or the focus taking the stage (`SHELF_STAGE_SETTINGS`).
   * Counts by variant: `section-shelf`.
   */
  products: [
    "grid",
    "carousel",
    "featured",
    "compact",
    "columns",
    "strips",
    "ranked",
    "stage_list",
  ],
  /**
   * A product page's related products (bilesen-denetimi (b) 7): `grid`,
   * today's rows; `carousel`, one row that slides (the scroller kit).
   */
  related_products: ["grid", "carousel"],
  /**
   * The shop's reviews (adr/0077 §10): `grid`, today's summary beside the
   * three newest quotes; `carousel`, the newest reviews one card each in a
   * row that slides (the scroller kit, `section-scroller`), each its
   * customer's photo when there is one, name, stars and quote.
   */
  reviews: ["grid", "carousel"],
  /**
   * A dated product's program (adr/0078): `timeline`, the steps down a
   * line, each open; `accordion`, each step a row that opens on its own.
   */
  program: ["timeline", "accordion"],
  /**
   * The main sections (adr/0049 Ek 2026-11-14 §5, §7), each with today's
   * drawing first. The header bar's `centered` is the theme setting's
   * centred header (`header.layout`), read into the bar by name; its
   * `catalog` (N14) a utility strip, a wide search with the shop's phone and
   * a filled menu bar with a "Kategoriler" button.
   * `inline` ("Tek satır"): one row, the wordmark at the start, the main
   * menu in the middle with the page's own link marked, round tools at the end.
   */
  header_bar: ["standard", "centered", "catalog", "inline"],
  /**
   * The top strip above the header (owner's decision 2026-11-27, adr/0066
   * Ek): `graphite`, today's dark bar (the lines, their button, the top
   * links and the phone); `light`, the thin light strip the catalog header
   * drew of its own (a note, the top links, "Hesabım").
   */
  announcement_bar: ["graphite", "light"],
  /**
   * `ledger`: today's steel-well ledger; `brand_columns` (adr/0049 Ek
   * 2026-11-17): a brand block beside the link columns, an optional strip
   * above (newsletter, contact), one bottom line with the ways to pay as
   * their marks (`FOOTER_COLUMNS_SETTINGS`); `free_rows` (adr/0070,
   * "Serbest düzen"): the shop's own rows, each a split of columns holding
   * blocks, above a fixed legal strip and bottom line (`section-footer-rows`).
   */
  footer_bar: ["ledger", "brand_columns", "free_rows"],
  /**
   * The newsletter box (adr/0049 Ek 2026-11-17 e-bülten): `standard`,
   * today's heading beside the stacked form; `split`, a low band, the
   * heading, a line and a small promise on the left, one joined field and
   * button on the right; `image_card`, a picture beside the heading, line
   * and form (no picture: drawn as `split`); `strip`, one thin row, an
   * envelope, the heading and a short line, a small joined form at its
   * end; `in_footer`, no box of its own: a small "Bültene katıl" in the
   * footer's brand column (the footer's box only, `NEWSLETTER_FOOTER_ONLY`).
   * Fields by variant: `section-newsletter`.
   */
  newsletter: ["standard", "split", "image_card", "strip", "in_footer"],
  /**
   * The shop's own text (adr/0073 §3): `pane`, today's heading beside the
   * text on the shadowed pane; `with_image` ("Görselli metin"), the same
   * pane with one of the media library's pictures on one side (5/12) and
   * the heading and text on the other (7/12), the picture on top on a
   * phone. The footer group takes `pane` only (adr/0070 §4: no picture
   * section there). `article` ("Sayfa metni", adr/0073 Ek 2026-11-19 (2)
   * K2): a content page's own text as the page draws it today, at reading
   * measure, an outline beside a long one and grouped questions in a
   * questions-and-answers text; a content page's only. Fields by variant:
   * `section-rich-text`.
   */
  rich_text: ["pane", "with_image", "article"],
  /**
   * Questions and answers (adr/0073 Ek 2026-11-24 (2)): `standard`, today's
   * heading on the left and the questions as rounded disclosures on the
   * right; `page` ("Sayfa SSS'si"), a content page's questions page drawn
   * as a questions text was before: the group headings as a row of topics
   * (a column from 1024 px) with the ways to reach the shop beside them,
   * each group's questions under its heading; a content page's only.
   * Fields by variant: `section-faq`.
   */
  faq: ["standard", "page"],
  /**
   * The shop's newest posts (adr/0077 Ek, "Vadi"): `grid`, today's three
   * tiles under the heading; `intro_panel` ("Tanıtım paneli"), one rounded
   * panel on the section's ground (a light tint unless the shop set one),
   * an upper line, the heading, a short intro and a button on one side,
   * two or three post cards (cover, title, reading time or date) on the
   * other, stacked on a phone. Fields by variant: `section-posts`.
   */
  posts: ["grid", "intro_panel"],
  /**
   * The picture band (adr/0077 Ek, "Vadi"): `standard`, today's slides
   * with their words over the pictures; `split` ("Bölünmüş bant"), the
   * first slide's picture on one side, its inner edge straight or curved
   * (`edge`), beside a panel on the section's ground (the dark stage
   * unless the shop set one) holding an upper line, the heading, the
   * line and the buttons; the picture on top on a phone. Fields by
   * variant: `section-banner`.
   */
  banner: ["standard", "split"],
  product_main: ["standard"],
  category_main: ["standard"],
} as const satisfies Record<string, readonly [string, ...string[]]>

/**
 * The catalog header's menu bar ground (adr/0049 Ek 2026-11-15, N14):
 * "Koyu / Ana renk / Hafif ton", the look's and the marquee's names
 * (bilesen-standardi §3); the first the default. Mirrored by the backend's
 * `HEADER_MENU_GROUNDS`.
 */
export const HEADER_MENU_GROUNDS = ["stage", "primary", "well"] as const

export type HeaderMenuGround = (typeof HEADER_MENU_GROUNDS)[number]

/**
 * A menu bar ground as a reader takes it: `light`, the light tint's name
 * before the dictionary had one, is `well` (bilesen-denetimi (b) 5); one
 * off the list is the default.
 */
export function headerMenuGroundOf(value: unknown): HeaderMenuGround {
  const named = value === "light" ? "well" : value
  return (HEADER_MENU_GROUNDS as readonly unknown[]).includes(named)
    ? (named as HeaderMenuGround)
    : "stage"
}

/**
 * Where the header's menus show the categories' small pictures (adr/0049
 * Ek 2026-11-15), every variant's setting: `all` "Her yerde" (the
 * catalog header's "Kategoriler" list too), `submenus` "Yalnız alt
 * menülerde" (the dropdowns and the phone's menu: the drawing from before
 * the setting, so the default), `off` "Yok" (words only). Mirrored by the
 * backend's `HEADER_MENU_IMAGES`.
 */
export const HEADER_MENU_IMAGES = ["all", "submenus", "off"] as const

export type HeaderMenuImages = (typeof HEADER_MENU_IMAGES)[number]

/** The menus' pictures as a reader takes them: absent or off the list, the default (`submenus`). */
export function headerMenuImagesOf(value: unknown): HeaderMenuImages {
  return (HEADER_MENU_IMAGES as readonly unknown[]).includes(value)
    ? (value as HeaderMenuImages)
    : "submenus"
}

/**
 * How the header's search stands (adr/0049 Ek 2026-11-15, adr/0066 §2
 * "küçük yerleşim → bölüm ayarı"), every variant's setting: `field`
 * "Kutu" (the search box drawn open, the drawing from before the setting,
 * so the default), `icon` "Simge, basınca açılır" (from 1024 px a
 * magnifier that opens the box beside it; on a phone no box in the
 * header, the bottom bar's "Ara" drops it down from the top). Mirrored by
 * the backend's `HEADER_SEARCH_STYLES`.
 */
export const HEADER_SEARCH_STYLES = ["field", "icon"] as const

export type HeaderSearchStyle = (typeof HEADER_SEARCH_STYLES)[number]

/**
 * The one-row header's tools (`inline`, adr/0066 §2 "küçük yerleşim → bölüm
 * ayarı"): `show` the cart's word beside its icon (the drawing from before
 * the setting, so the default), `hide` round icons only; each keeps its
 * accessible name. Mirrored by the backend's `HEADER_TOOL_LABELS`.
 */
export const HEADER_TOOL_LABELS = ["show", "hide"] as const

export type HeaderToolLabels = (typeof HEADER_TOOL_LABELS)[number]

/** The tools' words as a reader takes them: absent or off the list, the default (`show`). */
export function headerToolLabelsOf(value: unknown): HeaderToolLabels {
  return (HEADER_TOOL_LABELS as readonly unknown[]).includes(value)
    ? (value as HeaderToolLabels)
    : "show"
}

/**
 * The one-row header's tools (`header_bar` `inline`): `round`, each icon in
 * a hairline ring in a 96 px row (the drawing from before the setting, so
 * the default); `plain`, the search, account and cart as small plain icons
 * in a 72 px row, the action button (`highlight_link`) after them as a pill
 * with an arrow, favourites in the menu sheet and the account. Mirrored by
 * the backend's `HEADER_TOOLS_STYLES`.
 */
export const HEADER_TOOLS_STYLES = ["round", "plain"] as const

export type HeaderToolsStyle = (typeof HEADER_TOOLS_STYLES)[number]

/** The tools' look as a reader takes it: absent or off the list, `round`. */
export function headerToolsStyleOf(value: unknown): HeaderToolsStyle {
  return value === "plain" ? "plain" : "round"
}

/**
 * The product page gallery's picture shape (`product_main.image_ratio`):
 * `square` (the default, as drawn before the setting), `landscape` 4:3 or
 * `portrait` 3:4. Mirrored by the backend's `PRODUCT_IMAGE_RATIOS`.
 */
export const PRODUCT_IMAGE_RATIOS = ["square", "landscape", "portrait"] as const

export type ProductImageRatio = (typeof PRODUCT_IMAGE_RATIOS)[number]

/** The gallery's shape as a reader takes it: absent or off the list, the square. */
export function productImageRatioOf(value: unknown): ProductImageRatio {
  return (PRODUCT_IMAGE_RATIOS as readonly unknown[]).includes(value)
    ? (value as ProductImageRatio)
    : "square"
}

/**
 * Where a product's program stands (`program.place`, adr/0078): under the
 * product's own block as its own section (`section`, the default, as drawn
 * before the setting) or as a tab beside the description and the specs
 * (`tab`). Mirrored by the backend's `PROGRAM_PLACES`.
 */
export const PROGRAM_PLACES = ["section", "tab"] as const

export type ProgramPlace = (typeof PROGRAM_PLACES)[number]

/** The program's place as a reader takes it: absent or off the list, its own section. */
export function programPlaceOf(value: unknown): ProgramPlace {
  return (PROGRAM_PLACES as readonly unknown[]).includes(value)
    ? (value as ProgramPlace)
    : "section"
}

/**
 * How a header menu item's children open from 1024 px (adr/0049 Ek
 * 2026-11-26, adr/0066 §2 "tek davranış → bölüm ayarı"), every variant's
 * setting: `list` the dropdown under the item, one column of rows (the
 * drawing from before the setting, so the default); `mega` a wide panel
 * under the menu line, each child a column with its picture and its own
 * children as links, the item's own picture as a card beside them. A
 * phone's sheet is the same in both. Mirrored by the backend's
 * `HEADER_SUBMENU_STYLES`.
 */
export const HEADER_SUBMENU_STYLES = ["list", "mega"] as const

export type HeaderSubmenuStyle = (typeof HEADER_SUBMENU_STYLES)[number]

/** The submenus' look as a reader takes it: absent or off the list, the default (`list`). */
export function headerSubmenuStyleOf(value: unknown): HeaderSubmenuStyle {
  return value === "mega" ? "mega" : "list"
}

/** The search's look as a reader takes it: absent or off the list, the default (`field`). */
export function headerSearchStyleOf(value: unknown): HeaderSearchStyle {
  return (HEADER_SEARCH_STYLES as readonly unknown[]).includes(value)
    ? (value as HeaderSearchStyle)
    : "field"
}

/**
 * The catalog header's small layout choices (adr/0049 Ek 2026-11-15,
 * adr/0066 §2 "küçük yerleşim → bölüm ayarı"), each list's first step the
 * drawing from before it, so a bar saved without one reads as drawn:
 * where account, favourites and the cart stand (`bar`, the menu bar's
 * icons; `row`, beside the shop's phone with their names under them);
 * where the shop's top links stand (`strip`, the thin strip, shown only
 * while `utility_bar` is on; `bar`, quiet words at the menu bar's end,
 * whatever the strip); how wide the search is (`wide`; `narrow`, 35 rem
 * right after the wordmark). Mirrored by the backend's lists.
 */
export const HEADER_TOOLS_PLACES = ["bar", "row"] as const
export const HEADER_TOP_LINKS_PLACES = ["strip", "bar"] as const
export const HEADER_SEARCH_WIDTHS = ["wide", "narrow"] as const

export type HeaderToolsPlace = (typeof HEADER_TOOLS_PLACES)[number]
export type HeaderTopLinksPlace = (typeof HEADER_TOP_LINKS_PLACES)[number]
export type HeaderSearchWidth = (typeof HEADER_SEARCH_WIDTHS)[number]

/** A step as a reader takes it: absent (an older answer) or off its list, the list's first. */
function stepOf<T extends string>(steps: readonly [T, ...T[]], value: unknown): T {
  return (steps as readonly unknown[]).includes(value) ? (value as T) : steps[0]
}

export const headerToolsPlaceOf = (value: unknown): HeaderToolsPlace =>
  stepOf(HEADER_TOOLS_PLACES, value)
export const headerTopLinksPlaceOf = (value: unknown): HeaderTopLinksPlace =>
  stepOf(HEADER_TOP_LINKS_PLACES, value)
export const headerSearchWidthOf = (value: unknown): HeaderSearchWidth =>
  stepOf(HEADER_SEARCH_WIDTHS, value)

/** The catalog header's words: the search box's placeholder, the strip's note. Mirrored by the backend. */
export const HEADER_CATALOG_LIMITS = { search_placeholder: 60, strip_note: 80 } as const

/**
 * How a product card is drawn (adr/0049 Ek 2026-11-14 §3.3, owner's
 * decision 4): the theme setting's `product_card.variant` everywhere, a
 * product rail's `card_variant` over it. `standard`: today's card;
 * `framed`: a bordered box with the add button across its foot (UK5);
 * `compact` (Ek 2026-11-15): a small side-by-side card (photo left, name,
 * stars, price), no add button, the whole card one link. A `compact` or
 * `columns` rail draws its cards compact whatever is set.
 * Mirrored by the backend's `PRODUCT_CARD_VARIANTS`.
 */
export const CARD_VARIANTS = ["standard", "framed", "compact"] as const

export type CardVariant = (typeof CARD_VARIANTS)[number]

/** A card variant as a reader takes it: one on the list as it is, anything else `standard`. */
export const cardVariantOf = (value: unknown): CardVariant =>
  CARD_VARIANTS.find((each) => each === value) ?? CARD_VARIANTS[0]

export type VariantSectionType = keyof typeof SECTION_VARIANTS
export type SectionVariant<T extends VariantSectionType> = (typeof SECTION_VARIANTS)[T][number]
export type DefaultVariant<T extends VariantSectionType> = (typeof SECTION_VARIANTS)[T][0]

export type TrustBadgesVariant = SectionVariant<"trust_badges">
export type HeroVariant = SectionVariant<"hero">
export type CategoriesVariant = SectionVariant<"categories">
export type ProductsVariant = SectionVariant<"products">
export type RelatedProductsVariant = SectionVariant<"related_products">
export type ReviewsVariant = SectionVariant<"reviews">
export type ProgramVariant = SectionVariant<"program">
export type HeaderBarVariant = SectionVariant<"header_bar">
export type AnnouncementBarVariant = SectionVariant<"announcement_bar">
export type FooterBarVariant = SectionVariant<"footer_bar">
export type NewsletterVariant = SectionVariant<"newsletter">
export type RichTextVariant = SectionVariant<"rich_text">
export type FaqVariant = SectionVariant<"faq">
export type PostsVariant = SectionVariant<"posts">
export type BannerVariant = SectionVariant<"banner">
export type ProductMainVariant = SectionVariant<"product_main">
export type CategoryMainVariant = SectionVariant<"category_main">

export const isVariantType = (type: string): type is VariantSectionType =>
  Object.hasOwn(SECTION_VARIANTS, type)

/** The type's default variant: what a section without one, or with one not known here, is. */
export const defaultVariant = <T extends VariantSectionType>(type: T): DefaultVariant<T> =>
  SECTION_VARIANTS[type][0]

/** Whether the type offers a choice: the panel shows its "Biçim" only then. */
export function hasVariants(type: string): type is VariantSectionType {
  if (!isVariantType(type)) {
    return false
  }
  // A type keeps its list when a variant is taken off, so one may be left
  const listed: readonly string[] = SECTION_VARIANTS[type]
  return listed.length > 1
}

/**
 * A section's variant as a reader takes it (forgiving on reading, §2.3):
 * one on the type's list as it is; none, or one this build does not know
 * (a newer backend's), the type's default.
 */
export function variantOf<T extends VariantSectionType>(
  type: T,
  variant: unknown
): SectionVariant<T> {
  const listed: readonly unknown[] = SECTION_VARIANTS[type]
  return listed.includes(variant) ? (variant as SectionVariant<T>) : defaultVariant(type)
}
