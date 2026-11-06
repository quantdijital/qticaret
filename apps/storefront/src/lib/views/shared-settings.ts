import type { StoreLayout, StoreLayoutSettings, StorefrontFrame } from "@qticaret/types"

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
