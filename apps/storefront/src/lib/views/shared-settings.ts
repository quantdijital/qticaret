import type {
  StoreLayout,
  StoreLayoutSettings,
  StoreMenu,
  StorefrontAnswer,
  StorefrontFrame,
} from "@qticaret/types"

/**
 * The theme's shared settings (adr/0049 Ek 2026-11-06): the trust badges
 * and the colour names as the design gives them (a preview's draft
 * included), else the storefront frame's copy from a backend before them.
 */
export const sharedSettingsOf = (
  layout: Pick<StoreLayout, "settings">,
  frame: Pick<StorefrontFrame, "trust_badges" | "color_swatches">
): StoreLayoutSettings =>
  layout.settings ?? { trust_badges: frame.trust_badges, color_swatches: frame.color_swatches }

/**
 * The theme settings this request draws, raw for `themeSettings` to check
 * (adr/0063 §3): the design's (a preview's draft on its address), else the
 * frame's from a backend before the move. The second value is the old main
 * colour to fall back to: only for a backend so old that it gives no theme
 * at all; a theme given is already the whole choice, its "none" included.
 */
export function themeSourceOf(
  layout: Pick<StoreLayout, "settings">,
  answer: Pick<StorefrontAnswer, "theme" | "storefront">
): [unknown, string | null] {
  const theme = layout.settings?.theme ?? answer.theme
  return theme ? [theme, null] : [undefined, answer.storefront.primary_color]
}

/**
 * The menus this request prints (adr/0063 §3): the set a preview's draft
 * would put live, else the shop's live menus.
 */
export const menusOf = (layout: Pick<StoreLayout, "settings">, live: StoreMenu[]): StoreMenu[] =>
  layout.settings?.menus ?? live
