import { redirect } from "@tanstack/react-router"

/**
 * The old Storefront > Preferences page's tabs (`?part=`). The page left
 * the sidebar (the owner, 2026-11-16): the contact form and the payment
 * and shipping pages are a panel of the theme editor, maintenance is a
 * Settings page. Its old addresses (and Settings > Storefront's before
 * them, adr/0049) land where their part went.
 */
const PREFERENCES_TABS = ["contact", "infoPages", "maintenance"] as const
type PreferencesTab = (typeof PREFERENCES_TABS)[number]

const isPreferencesTab = (value: unknown): value is PreferencesTab =>
  typeof value === "string" && (PREFERENCES_TABS as readonly string[]).includes(value)

/** The old route's search: a known tab is kept, anything else left out. */
export const preferencesTabSearch = (search: Record<string, unknown>): { part?: PreferencesTab } =>
  isPreferencesTab(search["part"]) ? { part: search["part"] } : {}

/** The redirect an old preferences address throws: maintenance to Settings, the rest to the editor. */
export const movedPreferences = (part: PreferencesTab | undefined) =>
  part === "maintenance"
    ? redirect({ to: "/settings/maintenance", replace: true })
    : redirect({ to: "/storefront/editor", search: { open: "preferences" }, replace: true })
