import type { AccentFont, StoreThemeSettings } from "@qticaret/types"
import type { ThemeFont } from "@/lib/views/theme"

/**
 * Each face's files under `public/fonts` (`app/fonts.css` declares them):
 * its `latin` file, then its Turkish letters. A preload is chosen per
 * request, so it cannot be next/font's (fixed at build time for every
 * page): the faces are plain files at addresses known here.
 */
export const FONT_FILES: Readonly<Record<ThemeFont, readonly [string, string]>> = {
  inter: ["/fonts/inter-latin.c940764593.woff2", "/fonts/inter-tr.51341ab647.woff2"],
  fraunces: ["/fonts/fraunces-latin.22258e288b.woff2", "/fonts/fraunces-tr.001f80ce8b.woff2"],
  playfair: ["/fonts/playfair-latin.5d91eb5d52.woff2", "/fonts/playfair-tr.a7772d5272.woff2"],
  "dm-serif": ["/fonts/dm-serif-latin.f273cf2c9c.woff2", "/fonts/dm-serif-tr.556a09927e.woff2"],
  manrope: ["/fonts/manrope-latin.8bd97e6bbb.woff2", "/fonts/manrope-tr.d4c13b9d87.woff2"],
  "source-sans": [
    "/fonts/source-sans-latin.587435ca9d.woff2",
    "/fonts/source-sans-tr.2739d40613.woff2",
  ],
  nunito: ["/fonts/nunito-latin.20fc9b6fc6.woff2", "/fonts/nunito-tr.e5385d46f7.woff2"],
  "plus-jakarta": [
    "/fonts/plus-jakarta-latin.153fc85b70.woff2",
    "/fonts/plus-jakarta-tr.37427dca1e.woff2",
  ],
  montserrat: ["/fonts/montserrat-latin.06b16db7a9.woff2", "/fonts/montserrat-tr.324b17bf3a.woff2"],
}

/**
 * The accent faces' files (`ACCENT_FONTS`, `@qticaret/types/hand-note`),
 * the same way. Never preloaded: only a section's hand note is drawn in
 * one, so a browser fetches a file only when a page shows a note while
 * the shop has chosen that face (`--font-accent`, `lib/views/theme.ts`).
 */
export const ACCENT_FONT_FILES: Readonly<
  Record<Exclude<AccentFont, "none">, readonly [string, string]>
> = {
  caveat: ["/fonts/caveat-latin.891951df5e.woff2", "/fonts/caveat-tr.81d6c5c276.woff2"],
  "dancing-script": [
    "/fonts/dancing-script-latin.51acdc0e00.woff2",
    "/fonts/dancing-script-tr.4374430929.woff2",
  ],
  kalam: ["/fonts/kalam-latin.954410601a.woff2", "/fonts/kalam-tr.b90a584f5b.woff2"],
}

/**
 * The most a page preloads in faces, in bytes (docs/21, adr/0062 §7): the
 * heaviest pair, Fraunces with Inter, is 124 968. A face that takes a pair
 * past it cannot join the lists.
 */
export const FONT_PRELOAD_BUDGET = 125_000

/**
 * The files the page preloads: the shop's two faces (adr/0053 §B
 * `typography`), body first, and no other. The body face draws the
 * first text on a phone (the hero's line, the cookie notice); the
 * heading face draws the shop's name in the header and the page's h1,
 * above the fold on every page, so it is preloaded too. The faces the
 * shop did not choose cost its visitors nothing, the accent face
 * (`typography.accent`) included. No pair may pass
 * `FONT_PRELOAD_BUDGET` (the spec sums every pair's files).
 */
export function fontPreloads(settings: StoreThemeSettings): string[] {
  const { heading, body } = settings.typography
  const faces: ThemeFont[] = heading === body ? [body] : [body, heading]
  return faces.flatMap((font) => FONT_FILES[font])
}
