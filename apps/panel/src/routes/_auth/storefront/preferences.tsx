import { createFileRoute } from "@tanstack/react-router"
import { movedPreferences, preferencesTabSearch } from "@/features/storefront/preferences-tabs"

/**
 * The old Storefront > Preferences (adr/0049), out of the sidebar since
 * 2026-11-16: `?part=maintenance` opens Settings > Maintenance, the rest
 * the theme editor with its preferences panel open.
 */
export const Route = createFileRoute("/_auth/storefront/preferences")({
  validateSearch: preferencesTabSearch,
  beforeLoad: ({ search }) => {
    throw movedPreferences(search.part)
  },
})
