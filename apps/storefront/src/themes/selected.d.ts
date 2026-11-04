/**
 * The theme this build was made with (adr/0057): `next.config.ts` points
 * this at `src/themes/<name>.ts` (and `-styles` at its `.css`) from
 * `STOREFRONT_THEME`; unit tests at the base theme (`vitest.config.ts`).
 */
declare module "@qticaret/storefront-theme" {
  import type { ThemeEntry } from "@/themes/entry"

  export const entry: ThemeEntry
}
