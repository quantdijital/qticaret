/**
 * Storefront preferences' tabs, in their order; `?part=` names the open one.
 * The trust badges, colour swatches and "Az kaldı" moved to the theme
 * editor (adr/0049 Ek 2026-11-06): an old link to them opens the first tab.
 */
export const PREFERENCES_TABS = ["contact", "infoPages", "maintenance"] as const
export type PreferencesTab = (typeof PREFERENCES_TABS)[number]

const isPreferencesTab = (value: unknown): value is PreferencesTab =>
  typeof value === "string" && (PREFERENCES_TABS as readonly string[]).includes(value)

/** The route's search: a known tab is kept, anything else left out (the first tab opens). */
export const preferencesTabSearch = (search: Record<string, unknown>): { part?: PreferencesTab } =>
  isPreferencesTab(search["part"]) ? { part: search["part"] } : {}
