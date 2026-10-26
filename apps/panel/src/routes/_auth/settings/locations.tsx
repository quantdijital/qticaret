import { createFileRoute } from "@tanstack/react-router"
import { LocationsPage } from "@/features/settings/pages/locations-page"

export const Route = createFileRoute("/_auth/settings/locations")({
  component: LocationsPage,
})
