import { createFileRoute, redirect } from "@tanstack/react-router"
import { preferencesTabSearch } from "@/features/storefront/preferences-tabs"

/**
 * The old Settings > Storefront (adr/0049): its parts went to the theme
 * editor and Storefront > Preferences; a link to it opens the latter, on
 * the tab it names when it names one.
 */
export const Route = createFileRoute("/_auth/settings/storefront")({
  validateSearch: preferencesTabSearch,
  beforeLoad: ({ search }) => {
    // The full search keeps what no route validates: a part that moved is left out here
    throw redirect({
      to: "/storefront/preferences",
      search: preferencesTabSearch(search),
      replace: true,
    })
  },
})
