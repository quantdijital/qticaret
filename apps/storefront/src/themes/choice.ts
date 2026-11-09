/**
 * Which theme package this storefront is built with (adr/0057): one per
 * instance (instance-per-tenant), named by `STOREFRONT_THEME` when the
 * storefront is built or started in development. `next.config.ts` points
 * `@qticaret/storefront-theme` (the pages) and
 * `@qticaret/storefront-theme-styles` (the stylesheet) at the chosen
 * theme's entry under `src/themes/`; nothing else names a theme package.
 * Atölye is the only theme today (adr/0057 Ek 2026-11-09: the base theme
 * was removed); the variable stays for the themes to come.
 */
export const STOREFRONT_THEMES = ["atolye"] as const

export type StorefrontThemeName = (typeof STOREFRONT_THEMES)[number]

/** The theme a storefront is built with when `STOREFRONT_THEME` is unset or empty. */
export const DEFAULT_STOREFRONT_THEME: StorefrontThemeName = "atolye"

/**
 * The theme `STOREFRONT_THEME` names; unset or empty is Atölye. An
 * unknown name stops the build with the names it knows: a typo must not
 * ship a shop in another theme.
 */
export function storefrontThemeName(value: string | undefined): StorefrontThemeName {
  const name = value?.trim() ?? ""
  if (name === "") {
    return DEFAULT_STOREFRONT_THEME
  }
  const known = STOREFRONT_THEMES.find((theme) => theme === name)
  if (!known) {
    throw new Error(
      `STOREFRONT_THEME must be one of ${STOREFRONT_THEMES.join(", ")} (got "${name}")`
    )
  }
  return known
}

/**
 * The chosen theme's entries, as paths from the storefront's root
 * (Turbopack's aliases): its pages, its stylesheet, and its error page
 * (a client component on its own, adr/0046 Ek 2026-11-05).
 */
export const themeEntries = (name: StorefrontThemeName) => ({
  pages: `./src/themes/${name}.ts`,
  styles: `./src/themes/${name}.css`,
  error: `./src/themes/${name}-error.ts`,
})
