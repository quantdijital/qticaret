import { createFileRoute, redirect } from "@tanstack/react-router"
import { migrationSearch } from "@/features/settings/migration-search"
import { MigrationPage } from "@/features/settings/pages/migration-page"

export const Route = createFileRoute("/_auth/settings/migration/")({
  validateSearch: migrationSearch,
  // The team's bundle link (`?kaynak=paket`) opens the new migration with it
  beforeLoad: ({ search }) => {
    if (search.kaynak === "paket") {
      throw redirect({ to: "/settings/migration/new", search: { kaynak: "paket" } })
    }
  },
  component: MigrationPage,
})
