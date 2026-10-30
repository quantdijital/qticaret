import { createFileRoute } from "@tanstack/react-router"
import { MigrationPage } from "@/features/settings/pages/migration-page"

export const Route = createFileRoute("/_auth/settings/migration")({
  component: MigrationPage,
})
