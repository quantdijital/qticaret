import { PHOTO_COLLAGE_LIMITS, STATS_LIMITS, STEPS_LIMITS } from "@qticaret/types"
import type {
  PhotoCollageSection,
  StatsSection,
  StepsSection,
} from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import type { Problem } from "./problems"
import { linkProblem, textProblem } from "./problems"

/**
 * What the server would refuse in the figures strip and the numbered
 * steps (adr/0077 §10), found before the save, by field: each figure's
 * value and label, each step's title written, every text within its
 * length and naming only the shop's details. The forms keep the count
 * within the contract's (no removing below the least).
 */

type Found = [string, Problem | null]

/** A field that must be written: none is `required`, else its text's own problem. */
const written = (value: string, max: number, tokens: boolean): Problem | null =>
  value.trim() === "" ? "required" : textProblem(value, max, tokens)

export function statsProblems(section: StatsSection): Found[] {
  return [
    ["title", textProblem(section.title, L.title)],
    ...section.items.flatMap((item, index): Found[] => {
      const at = `items.${String(index)}`
      return [
        [`${at}.value`, written(item.value, STATS_LIMITS.value, false)],
        [`${at}.label`, written(item.label, STATS_LIMITS.label, true)],
        [`${at}.text`, textProblem(item.text, STATS_LIMITS.text, true)],
      ]
    }),
  ]
}

export function stepsProblems(section: StepsSection): Found[] {
  return [
    ["title", textProblem(section.title, L.title)],
    ["intro", textProblem(section.intro, STEPS_LIMITS.intro, true)],
    ...section.items.flatMap((item, index): Found[] => {
      const at = `items.${String(index)}`
      return [
        [`${at}.title`, written(item.title, STEPS_LIMITS.title, true)],
        [`${at}.text`, textProblem(item.text, STEPS_LIMITS.text, true)],
      ]
    }),
    ["link", linkProblem(section.link)],
  ]
}

/**
 * The photo collage (adr/0077 §10): each photograph chosen and its words
 * written (a collage names its pictures nowhere else), its caption and
 * link as any; the title and intro within their lengths.
 */
export function collageProblems(section: PhotoCollageSection): Found[] {
  return [
    ["title", textProblem(section.title, L.title)],
    ["intro", textProblem(section.intro, PHOTO_COLLAGE_LIMITS.intro, true)],
    ...section.items.flatMap((item, index): Found[] => {
      const at = `items.${String(index)}`
      return [
        [
          `${at}.image`,
          item.image === null
            ? "imageRequired"
            : written(item.image.alt ?? "", PHOTO_COLLAGE_LIMITS.alt, false),
        ],
        [`${at}.caption`, textProblem(item.caption, PHOTO_COLLAGE_LIMITS.caption, true)],
        [`${at}.link`, linkProblem(item.link)],
      ]
    }),
  ]
}
