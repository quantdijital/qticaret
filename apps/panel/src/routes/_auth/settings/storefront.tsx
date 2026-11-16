import { createFileRoute } from "@tanstack/react-router"
import { movedPreferences, preferencesTabSearch } from "@/features/storefront/preferences-tabs"

/**
 * The old Settings > Storefront (adr/0049): its parts went to the theme
 * editor, and so did Storefront > Preferences' after it (2026-11-16) but
 * maintenance, now in Settings; a link to it lands where the part it names went.
 */
export const Route = createFileRoute("/_auth/settings/storefront")({
  validateSearch: preferencesTabSearch,
  beforeLoad: ({ search }) => {
    // The full search keeps what no route validates: a part that moved is left out here
    throw movedPreferences(preferencesTabSearch(search).part)
  },
})
