import type { LayoutSettings } from "@/features/storefront/api/layout"
import { STOREFRONT_LIMITS as L, isHexColor } from "@/features/settings/storefront"
import { textProblem } from "./problems"
import type { Problem, SectionProblems } from "./problems"

/**
 * The theme's shared settings' problems (adr/0049 Ek 2026-11-06), keyed in
 * the document's problems under `SETTINGS_KEY` (never a section's id) by
 * field: `trust_badges.0.title`, `color_swatches.2.hex`, `low_stock.threshold`.
 */
export const SETTINGS_KEY = "@settings"

/** "Az kaldı" at 1 to 1000 units (the server's limits). */
export const LOW_STOCK_LIMITS = { min: 1, max: 1000, default: 3 } as const

/**
 * The two places that edit the settings, and the fields each holds: the
 * trust badges in every trust strip section's form, the rest in the
 * theme's "Stok ve renk örnekleri" panel.
 */
export type SettingsPart = "trust_badges" | "looks"

export const partOf = (field: string): SettingsPart =>
  field.startsWith("trust_badges") ? "trust_badges" : "looks"

/** The trust badges' problems alone, as every strip section shows them. */
export const badgeProblems = (problems: SectionProblems): SectionProblems =>
  Object.fromEntries(Object.entries(problems).filter(([field]) => partOf(field) === "trust_badges"))

type Found = [string, Problem | null]

const required = (value: string, max: number, tokens = false): Problem | null =>
  value.trim() === "" ? "required" : textProblem(value, max, tokens)

export function settingsProblems(settings: LayoutSettings): SectionProblems {
  const seen = new Set<string>()
  const found: Found[] = [
    ...settings.trust_badges.flatMap((badge, index): Found[] => {
      const at = `trust_badges.${String(index)}`
      return [
        [`${at}.title`, required(badge.title, L.badgeTitleLength, true)],
        [`${at}.text`, textProblem(badge.text, L.badgeTextLength, true)],
      ]
    }),
    ...settings.color_swatches.flatMap((swatch, index): Found[] => {
      const at = `color_swatches.${String(index)}`
      // A name written twice, in any Turkish case, is refused on its later row
      const name = swatch.label.trim().toLocaleLowerCase("tr")
      const twice = name !== "" && seen.has(name)
      seen.add(name)
      return [
        [`${at}.label`, twice ? "colorDuplicate" : required(swatch.label, L.swatchLabelLength)],
        [`${at}.hex`, isHexColor(swatch.hex) ? null : "colorInvalid"],
      ]
    }),
    [
      "low_stock.threshold",
      Number.isInteger(settings.low_stock.threshold) &&
      settings.low_stock.threshold >= LOW_STOCK_LIMITS.min &&
      settings.low_stock.threshold <= LOW_STOCK_LIMITS.max
        ? null
        : "thresholdRange",
    ],
  ]
  return Object.fromEntries(found.filter((entry): entry is [string, Problem] => entry[1] !== null))
}
