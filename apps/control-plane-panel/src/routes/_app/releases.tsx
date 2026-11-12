import { createFileRoute } from "@tanstack/react-router"
import { ReleasesPage } from "@/features/releases/pages/releases-page"

/** The platform's releases (adr/0061 F17.5, Ek C18): every role reads them. */
export const Route = createFileRoute("/_app/releases")({
  component: ReleasesPage,
})
