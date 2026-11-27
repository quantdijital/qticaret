/**
 * The theme section's plain step lists, each mirroring `@qticaret/types`'
 * own (`theme-section.unit.spec.ts` keeps them equal). Saved as JSON in the
 * section and the design's draft: a new step needs no migration, a stored
 * step keeps its meaning (adr/0066 K6).
 */

/**
 * The corners, sharpest first (adr/0062 §8): the theme scales its three
 * corners by each step; `soft` is its own and the default. `crisp` and
 * `gentle` came later, between `sharp` and `soft` (adr/0067 Ek 2026-11-16).
 * `RADIUS_STEPS` in the contract.
 */
export const RADIUS_STEPS = ["sharp", "crisp", "gentle", "soft", "round"] as const

/**
 * The gap between sections, theme-wide (Tezgâh audit K-11, as Shopify
 * themes' section spacing), closest first: `tight` (adr/0067 Ek
 * 2026-11-16), `compact` a dense catalog's, `normal` the theme's own gaps,
 * `roomy` a showcase's. `SECTION_SPACINGS` in the contract.
 */
export const SECTION_SPACINGS = ["tight", "compact", "normal", "roomy"] as const

/**
 * How the theme draws its boxes (Tezgâh audit Z-04): `filled` a tone darker
 * than the page (today's, the default), `lined` the page's ground inside a
 * 1 px rule. `SURFACE_STYLES` in the contract.
 */
export const SURFACE_STYLES = ["filled", "lined"] as const

/**
 * The face a section's hand note is drawn in (sahip 2026-11-24), `none`
 * first and the default: a few self-hosted handwriting faces, a name from
 * this list and never an address. Absent from a row before it: `none`.
 * `ACCENT_FONTS` in the contract (`hand-note.ts`).
 */
export const ACCENT_FONTS = [
  "none",
  "caveat",
  "dancing-script",
  "kalam",
  "dm-serif",
  "fraunces",
  "playfair",
] as const
