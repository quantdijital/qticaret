/** Storefront preferences' tabs, in their order; `?part=` names the open one. */
export const PREFERENCES_TABS = ["badges", "contact", "swatches", "maintenance"] as const
export type PreferencesTab = (typeof PREFERENCES_TABS)[number]

const isPreferencesTab = (value: unknown): value is PreferencesTab =>
  typeof value === "string" && (PREFERENCES_TABS as readonly string[]).includes(value)

/** The route's search: a known tab is kept, anything else left out (the first tab opens). */
export const preferencesTabSearch = (search: Record<string, unknown>): { part?: PreferencesTab } =>
  isPreferencesTab(search["part"]) ? { part: search["part"] } : {}
