/**
 * The opening's `full_image` variant (adr/0077 §9, "Tam görsel"): the
 * shop's photograph as the whole opening, its words over it; or
 * (`image_side: end`) the words on the page's ground with the photograph
 * beside them. Each setting a closed list of named steps the theme maps
 * onto its own scale (no number, no colour); a section switched to the
 * variant takes the defaults. The contract's lists: a new step goes here
 * first, then into the backend's mirror (`lib/storefront/sections/hero.ts`,
 * a test keeps them equal).
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-hero-full` subpath).
 */
export const HERO_FULL_SETTINGS = {
  /** What the opening asks for: its buttons, the shop's one search box (adr/0077 §1), or `both` (the buttons, then the box). */
  action: ["button", "search", "both"],
  /** The search box inside the opening, or as a card over its bottom edge; read only while the opening has the box. */
  search_position: ["inside", "overlap"],
  /** `screen`: about the screen's height; `tall`: about two thirds of it. */
  height: ["screen", "tall"],
  /** The veil over the photograph, under the words. */
  scrim: ["light", "strong"],
  align: ["center", "start"],
  /**
   * `full`: the photograph behind the words; `end`: beside them, the words on
   * the page's ground; `blend`: the photograph across the opening, the page's
   * ground washing over it in soft drawn shapes from the words' side.
   */
  image_side: ["full", "end", "blend"],
  /** The photograph's edge: its own rectangle, or a soft wave. */
  edge: ["straight", "wave"],
  /** The buttons' colour: the shop's main colour, or its accent (`colors.accent`). */
  button_tone: ["primary", "accent"],
  /** An arrow after the first button's words, for the eye only. */
  button_icon: ["none", "arrow"],
  /** A hand-drawn curl under the heading's second line, in the accent colour. */
  accent_mark: ["none", "swash"],
  /** A drawn sprig of leaves by the words, for the eye only. */
  ornament: ["none", "leaves"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type HeroFullSetting = keyof typeof HERO_FULL_SETTINGS
export type HeroFullStep<S extends HeroFullSetting> = (typeof HERO_FULL_SETTINGS)[S][number]

/** A section switched to `full_image`, and what a reader takes for a field it lacks. */
export const HERO_FULL_DEFAULTS: { readonly [S in HeroFullSetting]: HeroFullStep<S> } = {
  action: "button",
  search_position: "inside",
  height: "screen",
  scrim: "light",
  align: "center",
  image_side: "full",
  edge: "straight",
  button_tone: "primary",
  button_icon: "none",
  accent_mark: "none",
  ornament: "none",
}

export type HeroFullSettings = { [S in HeroFullSetting]: HeroFullStep<S> }

/** The heading's accent line at its longest, and the trust badges the opening shows at most. */
export const HERO_FULL_LIMITS = {
  title_accent: 90,
  trust: 4,
} as const

/** One setting as a reader takes it: missing or off its list reads as its default. */
export function heroFullStepOf<S extends HeroFullSetting>(
  name: S,
  value: unknown
): HeroFullStep<S> {
  const steps: readonly unknown[] = HERO_FULL_SETTINGS[name]
  return steps.includes(value) ? (value as HeroFullStep<S>) : HERO_FULL_DEFAULTS[name]
}

/** The variant's settings as a reader takes them. */
export function heroFullSettingsOf(
  section: Partial<Record<HeroFullSetting, unknown>>
): HeroFullSettings {
  return {
    action: heroFullStepOf("action", section.action),
    search_position: heroFullStepOf("search_position", section.search_position),
    height: heroFullStepOf("height", section.height),
    scrim: heroFullStepOf("scrim", section.scrim),
    align: heroFullStepOf("align", section.align),
    image_side: heroFullStepOf("image_side", section.image_side),
    edge: heroFullStepOf("edge", section.edge),
    button_tone: heroFullStepOf("button_tone", section.button_tone),
    button_icon: heroFullStepOf("button_icon", section.button_icon),
    accent_mark: heroFullStepOf("accent_mark", section.accent_mark),
    ornament: heroFullStepOf("ornament", section.ornament),
  }
}

/**
 * `full_image`'s own fields in `GET /store/storefront-layout`. The search
 * box's fields are the theme's (`StoreThemeSettings.search_form`) and the
 * trust badges the design's (`settings.trust_badges`): the section only
 * says whether they are shown.
 */
export interface StoreHeroFull extends Partial<HeroFullSettings> {
  variant: "full_image"
  /** A second line of the heading, drawn in the shop's colour; none: no line. */
  title_accent?: string | null
  /** The shop's trust badges in the opening (at most `HERO_FULL_LIMITS.trust`). */
  show_trust?: boolean
  /**
   * A YouTube or Vimeo link (`hero-video.ts`): a button under the words
   * plays it in a lightbox; none, or one the parser refuses: no button.
   */
  video_url?: string | null
  /** The video button's words (at most `HERO_VIDEO_LIMITS.label`); none: the theme's own. */
  video_label?: string | null
  /** A short hand note over the heading (`hand-note.ts`); null or absent: none. */
  note?: string | null
}
