import {
  BANNER_EYEBROW_MAX,
  HAND_NOTE_MAX,
  POSTS_INTRO_LIMITS,
  SECTION_EYEBROW_MAX,
} from "@qticaret/types"
import type { StoreHeadLines } from "@qticaret/types"
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

/**
 * A heading's upper line within its length, naming only the shop's
 * details, and its hand note within its own, plain text (`head-lines`):
 * the product rail, the categories, the departures, the reviews, the posts.
 */
export const headLinesProblems = (
  section: StoreHeadLines,
  eyebrowMax: number = SECTION_EYEBROW_MAX
): Found[] => [
  ["eyebrow", textProblem(section.eyebrow ?? null, eyebrowMax, true)],
  ["note", textProblem(section.note ?? null, HAND_NOTE_MAX)],
]

export function postsProblems(section: PostsSection): Found[] {
  const title: Found = ["title", textProblem(section.title, L.title)]
  // The upper line is every variant's since 2026-11-28, still at the panel's 40 characters
  const lines = headLinesProblems(section, POSTS_INTRO_LIMITS.eyebrow)
  if (section.variant !== "intro_panel") {
    return [title, ...lines]
  }
  return [
    ...lines,
    title,
    ["intro", textProblem(section.intro ?? null, POSTS_INTRO_LIMITS.intro, true)],
    ["link", linkProblem(section.link ?? null)],
  ]
}

/** The split's upper line within its length, naming only the shop's details. */
export const splitEyebrowProblem = (section: BannerSection): Problem | null =>
  textProblem(section.eyebrow ?? null, BANNER_EYEBROW_MAX, true)

/** The split's hand note within its length, plain text (no shop details). */
export const splitNoteProblem = (section: BannerSection): Problem | null =>
  textProblem(section.note ?? null, HAND_NOTE_MAX)
