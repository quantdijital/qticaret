/**
 * The opening's `full_image` variant's settings (adr/0077 §9, "Tam
 * görsel"): each a closed list of named steps, its default the opening as
 * a section switched to the variant draws it.
 *
 * Mirrors `@qticaret/types`' `HERO_FULL_SETTINGS`, `HERO_FULL_DEFAULTS`
 * and `HERO_FULL_LIMITS` (the backend reads no runtime value from that
 * package); a unit test keeps them equal.
 */
export const HERO_FULL_SETTINGS = {
  action: ["button", "search", "both"],
  search_position: ["inside", "overlap"],
  height: ["screen", "tall"],
  scrim: ["light", "strong", "faint"],
  align: ["center", "start"],
  image_side: ["full", "end", "blend"],
  edge: ["straight", "wave"],
  /** The buttons' colour: the shop's main colour, or its accent (`colors.accent`). */
  button_tone: ["primary", "accent"],
  /** An arrow after the first button's words, for the eye only. */
  button_icon: ["none", "arrow"],
  /** A hand-drawn curl under the heading's second line, in the accent colour. */
  accent_mark: ["none", "swash"],
  /** A drawn sprig of leaves by the words, for the eye only. */
  ornament: ["none", "leaves"],
  /** The heading in one face, or set light with its second part inline in an italic serif (the accent face). */
  title_mix: ["none", "serif_accent"],
  /** The words together, or the heading at the top and the text and buttons at the foot, the picture between. */
  words_place: ["together", "split"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type HeroFullSetting = keyof typeof HERO_FULL_SETTINGS
export type HeroFullStep<S extends HeroFullSetting> = (typeof HERO_FULL_SETTINGS)[S][number]

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
  title_mix: "none",
  words_place: "together",
}

/** The heading's accent line at its longest, and the trust badges the opening shows at most. */
export const HERO_FULL_LIMITS = {
  title_accent: 90,
  trust: 4,
} as const
