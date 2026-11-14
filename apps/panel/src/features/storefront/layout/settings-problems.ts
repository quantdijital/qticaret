import type { LayoutSettings } from "@/features/storefront/api/layout"
import { STOREFRONT_LIMITS as L, isHexColor } from "@/features/settings/storefront"
import { primaryReadable, primaryReadableInWell } from "@/theme/storefront"
import { textProblem } from "./problems"
import type { Problem, SectionProblems } from "./problems"

/**
 * The theme's shared settings' problems (adr/0049 Ek 2026-11-06), keyed in
 * the document's problems under `SETTINGS_KEY` (never a section's id) by
 * field: `trust_badges.0.title`, `color_swatches.2.hex`, `low_stock.threshold`,
 * `theme.colors.primary`.
 */
export const SETTINGS_KEY = "@settings"

/** "Az kaldı" at 1 to 1000 units (the server's limits). */
export const LOW_STOCK_LIMITS = { min: 1, max: 1000, default: 3 } as const

/**
 * The places that edit the settings, and the fields each holds: the trust
 * badges in every trust strip section's form, the theme's own settings in
 * "Tema ayarları" (adr/0063 §3), the rest in the theme's "Stok ve renk
 * örnekleri" panel.
 */
export type SettingsPart = "trust_badges" | "theme" | "looks"

export const partOf = (field: string): SettingsPart =>
  field.startsWith("trust_badges") ? "trust_badges" : field.startsWith("theme.") ? "theme" : "looks"

/** One part's problems alone, as its panel shows them. */
export const partProblems = (problems: SectionProblems, part: SettingsPart): SectionProblems =>
  Object.fromEntries(Object.entries(problems).filter(([field]) => partOf(field) === part))

/** The trust badges' problems alone, as every strip section shows them. */
export const badgeProblems = (problems: SectionProblems): SectionProblems =>
  partProblems(problems, "trust_badges")

type Found = [string, Problem | null]

const required = (value: string, max: number, tokens = false): Problem | null =>
  value.trim() === "" ? "required" : textProblem(value, max, tokens)

type Theme = LayoutSettings["theme"]

/**
 * A main colour or page colour changed from the saved draft's to a pair
 * the page's well cannot carry (adr/0062 §6), as the server refuses it; a
 * colour saved before the rule keeps saving until either is changed.
 */
function wellProblem(theme: Theme, saved: Theme | undefined): Problem | null {
  const { primary, background } = theme.colors
  const changed =
    saved !== undefined &&
    (primary !== saved.colors.primary || background !== saved.colors.background)
  return primary !== null && changed && !primaryReadableInWell(primary, background)
    ? "wellContrast"
    : null
}

/**
 * The theme's colours as the server checks them (adr/0053 §B, adr/0062 §6):
 * `#rrggbb` or none; a main colour that reads with white text and on the
 * page, and, once changed, in the page's well.
 */
function themeProblems(theme: Theme, saved: Theme | undefined): Found[] {
  const { primary, accent, background } = theme.colors
  const colour = (value: string | null): Problem | null =>
    value === null || isHexColor(value) ? null : "colorInvalid"
  return [
    [
      "theme.colors.primary",
      colour(primary) ??
        (primary !== null && !primaryReadable(primary, background) ? "contrast" : null) ??
        wellProblem(theme, saved),
    ],
    ["theme.colors.accent", colour(accent)],
  ]
}

/**
 * `savedTheme`: the draft's theme as the server holds it, what a colour
 * change is judged against for the well; left out, the well is not judged.
 */
export function settingsProblems(settings: LayoutSettings, savedTheme?: Theme): SectionProblems {
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
    ...themeProblems(settings.theme, savedTheme),
  ]
  return Object.fromEntries(found.filter((entry): entry is [string, Problem] => entry[1] !== null))
}
