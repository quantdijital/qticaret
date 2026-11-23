import { BANNER_EYEBROW_MAX, POSTS_INTRO_LIMITS } from "@qticaret/types"
import type { BannerSection, PostsSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import type { Problem } from "./problems"
import { linkProblem, textProblem } from "./problems"

/**
 * What the server would refuse in the posts' intro panel and the split
 * band (adr/0077 Ek), found before the save, by field: their words within
 * their lengths and naming only the shop's details, the panel's button
 * pointing somewhere. Off their own variant they hold none of these.
 */

type Found = [string, Problem | null]

export function postsProblems(section: PostsSection): Found[] {
  const title: Found = ["title", textProblem(section.title, L.title)]
  if (section.variant !== "intro_panel") {
    return [title]
  }
  return [
    ["eyebrow", textProblem(section.eyebrow ?? null, POSTS_INTRO_LIMITS.eyebrow, true)],
    title,
    ["intro", textProblem(section.intro ?? null, POSTS_INTRO_LIMITS.intro, true)],
    ["link", linkProblem(section.link ?? null)],
  ]
}

/** The split's upper line within its length, naming only the shop's details. */
export const splitEyebrowProblem = (section: BannerSection): Problem | null =>
  textProblem(section.eyebrow ?? null, BANNER_EYEBROW_MAX, true)
