import type { StoreLayoutLink } from "./layout.js"
import type { PostsVariant } from "./section-variants.js"

/**
 * The posts' own fields by variant (adr/0077 Ek, "Vadi"). `grid` has none
 * beyond the title and the count, which every variant shares and keeps
 * across a switch; `intro_panel` ("Tanıtım paneli") adds an upper line
 * above the heading, a short intro under it and one button (none: the
 * storefront's "every post" at the blog), all optional.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-posts` subpath, which Turbopack resolves).
 * Mirrored by the backend's `sections/posts.ts`; a test keeps them equal.
 */
export const POSTS_INTRO_LIMITS = { eyebrow: 40, intro: 200 } as const

/** At most this many post cards stand beside the panel's words (the first of the count). */
export const POSTS_INTRO_CARDS = 3

/**
 * The intro panel's look (each list's first: the panel as it was): its
 * ground as the section's (`ground`) or a light tint of the shop's main
 * colour over it (`tint`, "Panel tonu"); a leaf sprig at its lower right
 * (`leaves`, "Süs"); the cards' covers 16:10 (`standard`) or wider, 2:1
 * (`wide`, "Kapak oranı").
 */
export const POSTS_PANEL_SETTINGS = {
  panel_tone: ["ground", "tint"],
  ornament: ["none", "leaves"],
  cover_ratio: ["standard", "wide"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type PostsPanelSetting = keyof typeof POSTS_PANEL_SETTINGS
export type PostsPanelStep<S extends PostsPanelSetting> = (typeof POSTS_PANEL_SETTINGS)[S][number]

/** A setting as a reader takes it: absent or off the list, the first. */
export const postsPanelStepOf = <S extends PostsPanelSetting>(
  setting: S,
  value: unknown
): PostsPanelStep<S> => {
  const steps: readonly unknown[] = POSTS_PANEL_SETTINGS[setting]
  return (steps.includes(value) ? value : POSTS_PANEL_SETTINGS[setting][0]) as PostsPanelStep<S>
}

/**
 * The posts as the store API prints them: today's title and count, then
 * the variant's own only off the default, so a `grid` prints as it did
 * before variants. The storefront reads a variant it does not know as
 * `grid` (`variantOf`).
 */
export interface StorePostsSection {
  id: string
  type: "posts"
  title: string | null
  limit: number
  /** Absent: `grid`. */
  variant?: PostsVariant
  /** `intro_panel`: the line above the heading; null or absent: none. */
  eyebrow?: string | null
  /** `intro_panel`: the words under the heading; null or absent: none. */
  intro?: string | null
  /** `intro_panel`: the button; null or absent (or broken): the storefront's "every post". */
  link?: StoreLayoutLink | null
  /** `intro_panel`: printed only off the default; absent: `ground`, `none`, `standard`. */
  panel_tone?: PostsPanelStep<"panel_tone">
  ornament?: PostsPanelStep<"ornament">
  cover_ratio?: PostsPanelStep<"cover_ratio">
}
