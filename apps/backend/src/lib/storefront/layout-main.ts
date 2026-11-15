import type { LayoutDocument } from "./layout"
import type { MenuLinkInput } from "./menus"
import { footerBarDefaults, footerSettingsOf } from "./sections/footer-bar"
import { hasLook } from "./sections/look"
import type { SectionLook } from "./sections/look"
import { MAIN_SECTION_IDS } from "./sections/main"
import type {
  CategoryMain,
  FooterBar,
  HeaderBar,
  HeaderCatalog,
  ProductMain,
} from "./sections/main"

/**
 * The main sections read into a design stored without them (adr/0049 Ek
 * 2026-11-14 §5, §7): no migration, and the editor and the storefront see
 * the same page as before. The header bar takes the theme's header
 * (`header.layout`, `header.sticky`; `centered` stays `centered`, `left` is
 * today's `standard`); the first save writes them into the section, and
 * from then on the section is what the storefront draws. The others take
 * their defaults. The header's bar stands after the strips above it, the
 * product's block before the group's other sections; the footer's and the
 * category grid's place in the list means nothing to the page.
 */

/** The theme's header as the design (else the theme section) holds it. */
export interface ThemeHeader {
  layout: "centered" | "left"
  sticky: boolean
}

/** Grafit's header (`GRAFIT.header`): what a design with no theme at all reads. */
const DEFAULT_THEME_HEADER: ThemeHeader = { layout: "left", sticky: true }

export const defaultHeaderBar = (theme: ThemeHeader): HeaderBar => ({
  id: MAIN_SECTION_IDS.header_bar,
  type: "header_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: theme.layout === "centered" ? "centered" : "standard",
  sticky: theme.sticky,
})

const FOOTER_BAR: FooterBar = {
  id: MAIN_SECTION_IDS.footer_bar,
  type: "footer_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "ledger",
  ...footerBarDefaults(),
}

const PRODUCT_MAIN: ProductMain = {
  id: MAIN_SECTION_IDS.product_main,
  type: "product_main",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "standard",
}

const CATEGORY_MAIN: CategoryMain = {
  id: MAIN_SECTION_IDS.category_main,
  type: "category_main",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "standard",
  by_variant: {},
}

const has = (group: readonly { type: string }[], type: string) =>
  group.some((section) => section.type === type)

/** The document with every main section it lacks read in. */
export function withMainSections(doc: LayoutDocument, theme: ThemeHeader): LayoutDocument {
  return {
    ...doc,
    header: has(doc.header, "header_bar") ? doc.header : [...doc.header, defaultHeaderBar(theme)],
    footer: has(doc.footer, "footer_bar")
      ? doc.footer
      : [{ ...FOOTER_BAR, payment_badges: [] }, ...doc.footer],
    product: has(doc.product, "product_main") ? doc.product : [{ ...PRODUCT_MAIN }, ...doc.product],
    category: has(doc.category, "category_main")
      ? doc.category
      : [{ ...CATEGORY_MAIN, by_variant: {} }, ...doc.category],
  }
}

/** A group's main section, which `withMainSections` always reads in. */
export function mainOf<S extends { type: string }, T extends S["type"]>(
  group: readonly S[],
  type: T
): Extract<S, { type: T }> | undefined {
  return group.find((section): section is Extract<S, { type: T }> => section.type === type)
}

const lookOf = (section: { look?: SectionLook | undefined }) =>
  hasLook(section.look) ? { look: section.look } : {}

/**
 * The main sections as the storefront draws them (`GET /store/storefront-
 * layout`'s `main`): each with its id (the section's box) and variant; the
 * product's block and the category grid with their look only when the shop
 * set a step, as a body section prints it; the catalog header with its
 * own settings, its highlighted link placed by `resolve` (a broken one
 * null); the footer with the settings the shop changed. Read off a
 * document `withMainSections` filled; one somehow missing is its default.
 */
export function mainSectionsOf<L>(
  doc: LayoutDocument,
  resolve: (link: MenuLinkInput) => L | null = () => null
) {
  const header = mainOf(doc.header, "header_bar") ?? defaultHeaderBar(DEFAULT_THEME_HEADER)
  const footer = mainOf(doc.footer, "footer_bar") ?? FOOTER_BAR
  const product = mainOf(doc.product, "product_main") ?? PRODUCT_MAIN
  const category = mainOf(doc.category, "category_main") ?? CATEGORY_MAIN
  return {
    header_bar: {
      id: header.id,
      type: header.type,
      variant: header.variant,
      sticky: header.sticky,
      ...(header.variant === "catalog" ? { catalog: catalogOf(header, resolve) } : {}),
    },
    // Its own settings only when the shop changed them, so a footer left alone prints as before
    footer_bar: {
      id: footer.id,
      type: footer.type,
      variant: footer.variant,
      ...footerSettingsOf(footer),
    },
    product_main: {
      id: product.id,
      type: product.type,
      variant: product.variant,
      ...lookOf(product),
    },
    category_main: {
      id: category.id,
      type: category.type,
      variant: category.variant,
      by_variant: category.by_variant,
      ...lookOf(category),
    },
  }
}

/** The catalog header's own settings as the storefront draws them. */
function catalogOf<L>(header: HeaderCatalog, resolve: (link: MenuLinkInput) => L | null) {
  return {
    search_placeholder: header.search_placeholder,
    search_label: header.search_label,
    account_text: header.account_text,
    cart_total: header.cart_total,
    highlight_link: header.highlight_link ? resolve(header.highlight_link) : null,
    utility_bar: header.utility_bar,
    phone: header.phone,
    categories_button: header.categories_button,
    menu_ground: header.menu_ground,
  }
}
