import { bandsRise } from "@qticaret/types"
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
