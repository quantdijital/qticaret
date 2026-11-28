import { createFileRoute } from "@tanstack/react-router"
import { migrationWizardSearch } from "@/features/settings/migration-search"
import { MigrationWizardPage } from "@/features/settings/pages/migration-wizard-page"

export const Route = createFileRoute("/_auth/settings/migration/new")({
  validateSearch: migrationWizardSearch,
  component: MigrationWizardPage,
})
