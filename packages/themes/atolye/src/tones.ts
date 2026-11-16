import type { SectionSpacing, ThemeBackground } from "@qticaret/types"

/** The surfaces a page tone sets, by their token's name (`--color-<name>` in `tokens.css`). */
export const TONE_SURFACES = ["paper", "paper-2", "paper-3", "field", "chip", "rule"] as const

export type ToneSurface = (typeof TONE_SURFACES)[number]

export type ToneSet = Readonly<Record<ToneSurface, string>>

/**
 * The theme's surface family for each page tone the shop may choose
 * (adr/0062 §5): the counter, its two wells, a field's and a mark's light
 * ground, and the hairline. `steel` is Grafit's own, the values
 * `tokens.css` declares, and is never printed. The others start from the
 * tone's page colour as the backend's contrast check knows it
 * (`THEME_BACKGROUNDS`) and take Grafit's own steps from its counter in
 * OKLCH: lightness -2.8 (well), -6.8 (deep well), +1.0 (field), +0.2
 * (chip), -8.9 (rule), chroma by the same factors, the tone's hue kept.
 * The storefront's theme entry prints a chosen tone over the tokens at
 * `:root`; the graphite stages belong to no tone. The fixed inks hold
 * WCAG AA on every set (`themes/__tests__/atolye-tones.spec.ts` in the
 * storefront measures them).
 */
export const ATOLYE_TONES: Readonly<Record<ThemeBackground, ToneSet>> = {
  steel: {
    paper: "oklch(98.4% 0.003 250)",
    "paper-2": "oklch(95.6% 0.005 250)",
    "paper-3": "oklch(91.6% 0.007 250)",
    field: "oklch(99.4% 0.002 250)",
    chip: "oklch(98.6% 0.002 250)",
    rule: "oklch(89.5% 0.006 250)",
  },
  warm: {
    paper: "#f6f4ef",
    "paper-2": "#eeebe2",
    "paper-3": "#e2ddd2",
    field: "#f9f7f4",
    chip: "#f6f5f1",
    rule: "#dbd7cd",
  },
  neutral: {
    paper: "#f5f5f5",
    "paper-2": "#ececec",
    "paper-3": "#dfdfdf",
    field: "#f8f8f8",
    chip: "#f6f6f6",
    rule: "#d8d8d8",
  },
  cool: {
    paper: "#f3f5f8",
    "paper-2": "#e9ecf1",
    "paper-3": "#dadfe6",
    field: "#f7f8fa",
    chip: "#f4f6f8",
    rule: "#d4d8de",
  },
}

/**
 * The section spacing the shop may choose (Tezgâh audit K-11), as a factor
 * on every section gap (`--section-scale` over `tokens.css`'s gaps, each
 * screen width's own): `normal` is the theme's own and never printed;
 * `compact` brings the gap of 96 / 64 / 48 px (desktop / tablet / phone)
 * to 53 / 35 / 26 px, a dense catalog's rhythm; `roomy` opens it to
 * 115 / 77 / 58 px.
 */
export const ATOLYE_SECTION_SCALE: Readonly<Record<SectionSpacing, string | null>> = {
  tight: "0.35",
  compact: "0.55",
  normal: null,
  roomy: "1.2",
}
