import { baseTheme } from "@qticaret/theme-base"
import type { StorefrontTheme } from "@qticaret/ui"

/**
 * Atölye (adr/0057, design.md at the repository's root): Hallmark's Loom
 * on the theme contract, sector-neutral; the shop's facts arrive as data.
 * The pages it has not drawn yet are the base theme's, in its tokens.
 */
export const atolyeTheme: StorefrontTheme = {
  ...baseTheme,
  name: "atolye",
}
