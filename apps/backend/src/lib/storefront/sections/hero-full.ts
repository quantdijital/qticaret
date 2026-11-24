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
  action: ["button", "search"],
  search_position: ["inside", "overlap"],
  height: ["screen", "tall"],
  scrim: ["light", "strong"],
  align: ["center", "start"],
  image_side: ["full", "end"],
  edge: ["straight", "wave"],
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
}

/** The heading's accent line at its longest, and the trust badges the opening shows at most. */
export const HERO_FULL_LIMITS = {
  title_accent: 90,
  trust: 4,
} as const
