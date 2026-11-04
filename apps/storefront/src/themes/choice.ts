/**
 * Which theme package this storefront is built with (adr/0057): one per
 * instance (instance-per-tenant), named by `STOREFRONT_THEME` when the
 * storefront is built or started in development. `next.config.ts` points
 * `@qticaret/storefront-theme` (the pages) and
 * `@qticaret/storefront-theme-styles` (the stylesheet) at the chosen
 * theme's entry under `src/themes/`; nothing else names a theme package.
 */
export const STOREFRONT_THEMES = ["base", "atolye"] as const

export type StorefrontThemeName = (typeof STOREFRONT_THEMES)[number]

/**
 * The theme `STOREFRONT_THEME` names; unset or empty is `base`, today's
 * look. An unknown name stops the build with the names it knows: a typo
 * must not ship a shop in another theme.
 */
export function storefrontThemeName(value: string | undefined): StorefrontThemeName {
  const name = value?.trim() ?? ""
  if (name === "") {
    return "base"
  }
  const known = STOREFRONT_THEMES.find((theme) => theme === name)
  if (!known) {
    throw new Error(
      `STOREFRONT_THEME must be one of ${STOREFRONT_THEMES.join(", ")} (got "${name}")`
    )
  }
  return known
}

/** The chosen theme's two entries, as paths from the storefront's root (Turbopack's aliases). */
export const themeEntries = (name: StorefrontThemeName) => ({
  pages: `./src/themes/${name}.ts`,
  styles: `./src/themes/${name}.css`,
})
