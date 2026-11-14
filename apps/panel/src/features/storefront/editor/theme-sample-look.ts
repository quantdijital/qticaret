import { isHexColor } from "@/features/settings/storefront"
import { SERIF_FONTS, SINGLE_WEIGHT_FONTS } from "@/features/storefront/api/theme"
import type { BodyFont, HeadingFont } from "@/features/storefront/api/theme"
import type { ThemeValues } from "@/features/storefront/theme-settings"
import {
  ATOLYE_BUTTON_RADIUS,
  ATOLYE_CARD_RATIO,
  ATOLYE_COLORS,
  ATOLYE_DISPLAY_WEIGHT,
  ATOLYE_NOTE_SHARE,
  ATOLYE_PILL,
  ATOLYE_RADII,
  ATOLYE_RADIUS_SCALE,
  ATOLYE_SINGLE_WEIGHT,
  ATOLYE_TONES,
} from "@/theme/atolye"
import { STOREFRONT_BACKGROUNDS, storefrontTextOn } from "@/theme/storefront"

/**
 * What the Atölye theme paints for the form's choices (adr/0062 §5–§12),
 * as plain values the sample puts on its elements. The theme's own values
 * come from `@/theme/atolye`, a mirror its spec holds to the theme's files.
 */

type Font = HeadingFont | BodyFont

// The storefront's own fallbacks per kind (`lib/views/theme.ts`)
const SERIF = 'ui-serif, Georgia, "Times New Roman", serif'
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

/**
 * The storefront's faces the panel has loaded too: Inter alone, the
 * panel's own face (`@fontsource-variable/inter`, `main.tsx`). The others
 * are files of the storefront; the sample names them and draws their kind
 * (serif or sans) in a system face instead of passing one off as another.
 */
const PANEL_FACES: Partial<Record<Font, string>> = { inter: '"Inter Variable"' }

export interface SampleFace {
  font: Font
  /** Whether the sample draws the face itself; if not, a system face of its kind. */
  loaded: boolean
  family: string
}

const faceOf = (font: Font): SampleFace => {
  const fallback = SERIF_FONTS.has(font) ? SERIF : SANS
  const own = PANEL_FACES[font]
  return { font, loaded: own !== undefined, family: own ? `${own}, ${fallback}` : fallback }
}

/** A corner at the chosen scale, to a tenth of a pixel. */
const scaled = (px: number, scale: number) => Math.round(px * scale * 10) / 10

export interface SampleLook {
  /** The page colour with its tone's well (a card's picture, a chip) and field ground. */
  page: string
  well: string
  field: string
  /** The announcement bar: the theme's graphite whatever the colours are. */
  bar: { background: string; color: string }
  /** Buttons and links: the shop's main colour, else the theme's wine. */
  primary: string
  primaryText: string
  /** Whether the main colour is the theme's own (none chosen). */
  ownPrimary: boolean
  /** The selected chip, tab and counts: the accent, else the theme's graphite on the page colour. */
  mark: string
  markText: string
  /** A note's tinted ground: a little of the accent, else of the main colour, in the page colour. */
  note: string
  /** Boxes, pictures and inner corners in px, scaled by the corner choice. */
  corners: { tile: number; media: number; inner: number }
  /** Buttons and fields; chips and badges keep `pill`. */
  control: string
  pill: string
  ratio: string
  heading: SampleFace
  headingWeight: number
  body: SampleFace
  /** The chosen faces the panel cannot draw, heading first, each once. */
  unloaded: Font[]
  showBrand: boolean
  showRating: boolean
}

export function sampleLook(values: ThemeValues): SampleLook {
  const { colors, typography, product_card } = values
  const page = STOREFRONT_BACKGROUNDS[colors.background]
  const ownPrimary = !isHexColor(colors.primary)
  const primary = ownPrimary ? ATOLYE_COLORS.wine : colors.primary
  const accent = isHexColor(colors.accent) ? colors.accent : null
  const tone = ATOLYE_TONES[colors.background]
  const scale = ATOLYE_RADIUS_SCALE[values.radius]
  const heading = faceOf(typography.heading)
  const body = faceOf(typography.body)
  return {
    page,
    well: tone.well,
    field: tone.field,
    bar: { background: ATOLYE_COLORS.stage, color: ATOLYE_COLORS.stageText },
    primary,
    primaryText: storefrontTextOn(primary),
    ownPrimary,
    mark: accent ?? ATOLYE_COLORS.text,
    markText: accent ? storefrontTextOn(accent) : page,
    note: `color-mix(in oklab, ${accent ?? primary} ${String(ATOLYE_NOTE_SHARE)}%, ${page})`,
    corners: {
      tile: scaled(ATOLYE_RADII.tile, scale),
      media: scaled(ATOLYE_RADII.media, scale),
      inner: scaled(ATOLYE_RADII.inner, scale),
    },
    control: ATOLYE_BUTTON_RADIUS[values.buttons],
    pill: ATOLYE_PILL,
    ratio: ATOLYE_CARD_RATIO[product_card.ratio],
    heading,
    headingWeight: SINGLE_WEIGHT_FONTS.has(typography.heading)
      ? ATOLYE_SINGLE_WEIGHT
      : ATOLYE_DISPLAY_WEIGHT,
    body,
    unloaded: [...new Set([heading, body].filter((face) => !face.loaded).map((face) => face.font))],
    showBrand: product_card.show_brand,
    showRating: product_card.show_rating,
  }
}
