import type { PostsVariant } from "@qticaret/types"
import type { PostCardView } from "./content-views"
import type { LinkView } from "./views"

/**
 * The shop's newest posts as a theme draws them: today's tiles, or as
 * `intro_panel` (adr/0077 Ek, "Tanıtım paneli") one panel holding an upper
 * line, the heading, a short intro and a button (`more`: the shop's link,
 * else the storefront's "every post") beside the first two or three cards.
 * A theme without that drawing draws the tiles (`drawnVariant`).
 */
export interface PostsSectionView {
  id: string
  type: "posts"
  title: string
  posts: PostCardView[]
  more: LinkView
  /** Absent: the tiles. */
  variant?: PostsVariant
  /** `intro_panel`: the line above the heading; null: none. */
  eyebrow?: string | null
  /** `intro_panel`: the words under the heading; null: none. */
  intro?: string | null
  /** `intro_panel`: a light tint of the main colour over the ground; absent: the ground. */
  panelTone?: "tint"
  /** `intro_panel`: a leaf sprig at the panel's lower right; absent: none. */
  ornament?: "leaves"
  /** `intro_panel`: the covers 2:1; absent: 16:10. */
  coverRatio?: "wide"
}
