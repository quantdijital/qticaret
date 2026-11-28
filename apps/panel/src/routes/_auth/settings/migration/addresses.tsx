import { createFileRoute } from "@tanstack/react-router"
import { MigrationAddressesPage } from "@/features/settings/pages/migration-addresses-page"

export const Route = createFileRoute("/_auth/settings/migration/addresses")({
  component: MigrationAddressesPage,
})
