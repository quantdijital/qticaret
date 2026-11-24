import { HERO_FULL_LIMITS, bandsRise } from "@qticaret/types"
import type { HeroSection, PriceBandsSection } from "@/features/storefront/api/layout"
import {
  HERO_CATALOG_LIMITS,
  LAYOUT_LIMITS as L,
  PRICE_BANDS_LIMITS,
} from "@/features/storefront/api/layout"
import type { Problem } from "./problems"
import { linkProblem, textProblem } from "./problems"

/**
 * What the server would refuse in the catalogue home page's parts (adr/0049
 * Ek 2026-11-14, Katalog), found before the save, by field: H17's picked
 * list, quick links and picks' labels; the price bands' labels, lines and
 * order.
 */

type Found = [string, Problem | null]

/** The full image's accent line (adr/0077 §9): within its limit, the shop's details allowed. */
export function heroFullProblems(section: HeroSection): Found[] {
  return section.variant === "full_image"
    ? [
        [
          "title_accent",
          textProblem(section.title_accent ?? null, HERO_FULL_LIMITS.title_accent, true),
        ],
      ]
    : []
}

/** H17's own fields; today's opening has none. */
export function heroCatalogProblems(section: HeroSection): Found[] {
  if (section.variant !== "category_list") {
    return []
  }
  return [
    [
      "list",
      section.list.kind === "manual" && section.list.category_ids.length === 0
        ? "categoryRequired"
        : null,
    ],
    ...section.chips.map((chip, index): Found => [`chips.${String(index)}`, linkProblem(chip)]),
    ...section.tiles.map((tile, index): Found => [
      `tiles.${String(index)}`,
      textProblem(tile.image?.alt ?? null, L.alt),
    ]),
    ...section.picks.map((pick, index): Found => [
      `picks.${String(index)}`,
      textProblem(pick.label, HERO_CATALOG_LIMITS.pickLabel),
    ]),
    // The opening's slides (adr/0049 Ek 2026-11-15): one with neither picture nor words is refused
    ...(section.slides ?? []).flatMap((slide, index): Found[] => {
      const at = `slides.${String(index)}`
      const empty =
        slide.image === null &&
        slide.heading === null &&
        slide.text === null &&
        slide.links.length === 0
      return [
        [`${at}.image`, empty ? "required" : textProblem(slide.image?.alt ?? null, L.alt)],
        [`${at}.heading`, textProblem(slide.heading, L.heading, true)],
        [`${at}.text`, textProblem(slide.text, L.text, true)],
        ...slide.links.map((link, place): Found => [
          `${at}.links.${String(place)}`,
          linkProblem(link),
        ]),
        [`${at}.link`, linkProblem(slide.link)],
      ]
    }),
  ]
}

/** Each band's label (required) and line; the bands rising, an open one only last. */
export function priceBandsProblems(section: PriceBandsSection): Found[] {
  return [
    ["title", textProblem(section.title, L.title)],
    ["bands", bandsRise(section.bands) ? null : "bandsOrder"],
    ...section.bands.flatMap((band, index): Found[] => {
      const at = `bands.${String(index)}`
      return [
        [
          `${at}.label`,
          band.label.trim() === ""
            ? "required"
            : textProblem(band.label, PRICE_BANDS_LIMITS.label, true),
        ],
        [`${at}.text`, textProblem(band.text, PRICE_BANDS_LIMITS.text, true)],
      ]
    }),
  ]
}
