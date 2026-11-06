import { createFileRoute } from "@tanstack/react-router"
import { PreferencesPage } from "@/features/storefront/pages/preferences-page"
import { preferencesTabSearch } from "@/features/storefront/preferences-tabs"

/** `/storefront/preferences?part=contact|infoPages|maintenance` (adr/0049). */
export const Route = createFileRoute("/_auth/storefront/preferences")({
  validateSearch: preferencesTabSearch,
  component: PreferencesPage,
})
