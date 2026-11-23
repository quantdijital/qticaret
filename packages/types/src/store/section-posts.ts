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
}
