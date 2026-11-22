/**
 * The figures strip (`stats`, adr/0077 §10): an optional title over two to
 * six figures, each a short value set large ("20 yıl", "10.000+", "8.000 m"),
 * its label and an optional line under it. Sector-free: the shop's own
 * figures in its own words, never counted or animated. Its ground and
 * alignment are the section look's (`look.ground`, `look.align`), not its
 * own. The contract's list: a new step goes here first, then into the
 * backend's mirror (`lib/storefront/sections/stats.ts`, a test keeps them
 * equal), then into the themes. The panel's Turkish names are
 * `storefront.editor.stats.<setting>.*`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-stats` subpath).
 */

/** How many figures, and each part's longest text. */
export const STATS_LIMITS = {
  items: { min: 2, max: 6 },
  value: 16,
  label: 48,
  text: 120,
} as const

export const STATS_SETTINGS = {
  /** Hairlines between the figures (`on`) or space alone (`off`). */
  dividers: ["on", "off"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type StatsSetting = keyof typeof STATS_SETTINGS
export type StatsStep<S extends StatsSetting> = (typeof STATS_SETTINGS)[S][number]

/** A new strip's settings, and what one without them reads as. */
export const STATS_DEFAULTS: { readonly [S in StatsSetting]: StatsStep<S> } = {
  dividers: "on",
}

export const STATS_SETTING_NAMES = Object.keys(STATS_SETTINGS) as StatsSetting[]

export type StatsSettings = { [S in StatsSetting]: StatsStep<S> }

/** Every setting as a reader takes it: one missing or off this build's list reads as its default. */
export function statsSettingsOf(section: Partial<Record<StatsSetting, unknown>>): StatsSettings {
  const steps: readonly unknown[] = STATS_SETTINGS.dividers
  return {
    dividers: steps.includes(section.dividers)
      ? (section.dividers as StatsStep<"dividers">)
      : STATS_DEFAULTS.dividers,
  }
}

/** One figure: its value set large, its label, an optional line (the shop's details filled). */
export interface StoreStatsItem {
  value: string
  label: string
  text: string | null
}

/** The figures strip in `GET /store/storefront-layout`. */
export type StoreStatsSection = {
  id: string
  type: "stats"
  /** None: no heading (the strip is named for screen readers by the storefront). */
  title: string | null
  items: StoreStatsItem[]
} & Partial<StatsSettings>
