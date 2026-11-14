/**
 * The Atölye storefront theme's own values, as far as the theme settings
 * form draws them (adr/0062 §12): its sample shows what the storefront
 * paints, so these are the theme's tokens, not the panel's.
 *
 * The panel does not depend on the theme package (a storefront build with
 * its own Tailwind layer), so the values are mirrored here in sRGB.
 * `atolye.spec.ts` reads the theme's `tokens.css` and `styles.css` and the
 * storefront's `lib/views/theme.ts`, converts each OKLCH token the CSS
 * Color 4 way and fails when a value here no longer matches.
 */

/** Colours: `packages/themes/atolye/src/tokens.css` (`--color-*`) and `styles.css` (`--primary`). */
export const ATOLYE_COLORS = {
  /** `--primary`: the theme's graphite-wine, the main colour while the shop has chosen none. */
  wine: "#681946",
  /** `--color-stage` and `--color-stage-text`: the graphite the announcement bar stands on. */
  stage: "#11151a",
  stageText: "#f1f4f6",
  /** `--color-text`, `-2` and `-3`: headings and body, a rating's count, a card's brand. */
  text: "#12161b",
  text2: "#363b41",
  text3: "#54585f",
  /** `--color-edge` and `--color-placeholder`: a form field's line and its example text. */
  edge: "#767b80",
  placeholder: "#6b6f75",
  /** `--color-star`: a rating's stars. */
  star: "#d48e00",
} as const

/** `--radius-tile`, `--radius-media` and `--radius-inner` in px, at the corner scale 1 ("soft"). */
export const ATOLYE_RADII = { tile: 20, media: 14, inner: 10 } as const

/** The corner scale each choice multiplies them by (storefront `RADIUS_SCALE`; soft is the theme's own). */
export const ATOLYE_RADIUS_SCALE = { sharp: 0.2, soft: 1, round: 1.5 } as const

/**
 * The corners of buttons, the search field, form fields and the quantity
 * stepper (storefront `BUTTON_RADIUS`; pill is the theme's own
 * `--button-radius`). Chips and badges stay pills whatever is chosen.
 */
export const ATOLYE_BUTTON_RADIUS = { pill: "999px", rounded: "0.75rem", square: "0px" } as const
export const ATOLYE_PILL = "999px"

/** The card picture's shape (storefront `CARD_RATIO`; square is the theme's own `--card-ratio`). */
export const ATOLYE_CARD_RATIO = { "4:5": "4 / 5", "1:1": "1 / 1", "3:4": "3 / 4" } as const

/**
 * A heading's weight: the theme's `--display-weight`, and the one weight
 * DM Serif Display has (adr/0062 §7).
 */
export const ATOLYE_DISPLAY_WEIGHT = 800
export const ATOLYE_SINGLE_WEIGHT = 400

/**
 * The surfaces that go with each page colour (the theme's `tones.ts`,
 * adr/0062 §5): the well a card's picture and a chip sit in (`paper-2`) and
 * a form field's ground (`field`). The page itself is
 * `STOREFRONT_BACKGROUNDS`; the graphite stages belong to no tone.
 */
export const ATOLYE_TONES = {
  steel: { well: "#eef1f4", field: "#fcfdfe" },
  warm: { well: "#eeebe2", field: "#f9f7f4" },
  neutral: { well: "#ececec", field: "#f8f8f8" },
  cool: { well: "#e9ecf1", field: "#f7f8fa" },
} as const

/**
 * The share of the accent (else the main colour) mixed into the page for a
 * note's tinted ground (`--color-highlight-soft` in `tokens.css`).
 */
export const ATOLYE_NOTE_SHARE = 9
