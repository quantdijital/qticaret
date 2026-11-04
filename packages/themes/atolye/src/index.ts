import { baseTheme } from "@qticaret/theme-base"
import type { StorefrontTheme } from "@qticaret/ui"
import { HomePage } from "./HomePage"
import { Layout } from "./Layout"

/**
 * Atölye (adr/0057, design.md at the repository's root): Hallmark's Loom
 * on the theme contract, sector-neutral; the shop's facts arrive as data.
 * Drawn so far: the frame and the home page. The pages it has not drawn yet are the base
 * theme's, in Atölye's tokens.
 */
export const atolyeTheme: StorefrontTheme = {
  ...baseTheme,
  name: "atolye",
  Layout,
  HomePage,
}
