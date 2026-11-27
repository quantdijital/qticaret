import { createFileRoute } from "@tanstack/react-router"
import { migrationSearch } from "@/features/settings/migration-search"
import { MigrationPage } from "@/features/settings/pages/migration-page"

export const Route = createFileRoute("/_auth/settings/migration")({
  validateSearch: migrationSearch,
  component: MigrationPage,
})
