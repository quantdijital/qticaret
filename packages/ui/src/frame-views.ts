import type { CardRatio } from "@qticaret/types"
import type { StyleKit } from "@qticaret/types/style-kit"

/**
 * The shop's theme choices a theme draws by itself (F18 D11, adr/0053 §B).
 * Colours, faces and corner sizes reach it as CSS variables the storefront
 * prints (`--primary`, `--font-heading`, `--radius-scale`…); these are the
 * choices that change markup.
 */
export interface ThemeView {
  card: {
    /** The picture's shape; also `--card-ratio`. */
    ratio: CardRatio
    /** The storefront leaves `brand` out of the cards when the shop hides it. */
    showBrand: boolean
    /** Stars on a card, when its view carries a rating. */
    showRating: boolean
  }
  header: {
    /** The logo in the middle with search on its left, or the logo first. */
    layout: "centered" | "left"
    /** The header stays at the top of a long page. */
    sticky: boolean
  }
  /** The buttons' corners; also `--button-radius`. */
  buttons: "pill" | "rounded" | "square"
  /**
   * How the boxes stand (theme setting `surface_style`): a filled tone or a
   * 1 px rule; also `--box-ground` and `--box-line`. Absent: `filled`.
   */
  surface?: "filled" | "lined"
  /**
   * The style kit (adr/0067 §1): menu items, shadow, chips, the photos'
   * ground. The theme marks a step off the default on its root element
   * (`styleKitAttributes`, `@qticaret/types`). Absent, or a field absent: its default.
   */
  styleKit?: Partial<StyleKit>
}

/** The phone's bottom bar's items (docs/20 "mobil alt gezinme"). */
export type BottomNavItem = "home" | "categories" | "search" | "cart" | "account"

/** The phone's bottom bar (under 1024 px): which item the page is under. */
export interface BottomNavView {
  /** The item the page belongs to; null: none of them. */
  current: BottomNavItem | null
}
