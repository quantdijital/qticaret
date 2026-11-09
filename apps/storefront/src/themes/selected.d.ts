/**
 * The theme this build was made with (adr/0057): `next.config.ts` points
 * this at `src/themes/<name>.ts` (and `-styles` at its `.css`, `-error` at
 * its `-error.ts`) from `STOREFRONT_THEME`; unit tests at the default
 * theme, Atölye (`vitest.config.ts`).
 */
declare module "@qticaret/storefront-theme" {
  import type { ThemeEntry } from "@/themes/entry"

  export const entry: ThemeEntry
}

/** The theme's error page (adr/0046 Ek 2026-11-05): a client component, apart from its pages. */
declare module "@qticaret/storefront-theme-error" {
  import type { ThemeErrorPage } from "@qticaret/ui"

  export const ErrorPage: ThemeErrorPage
}
