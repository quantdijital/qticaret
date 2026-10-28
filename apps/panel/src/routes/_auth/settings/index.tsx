import { createFileRoute } from "@tanstack/react-router"
import { SettingsHomePage } from "@/features/settings/pages/settings-home-page"

// Settings' first page: every section in its group
export const Route = createFileRoute("/_auth/settings/")({
  component: SettingsHomePage,
})
