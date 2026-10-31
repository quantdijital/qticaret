import { createFileRoute } from "@tanstack/react-router"
import { settingsTabSearch } from "@/features/settings/tab-search"
import { NotificationsPage } from "@/features/settings/pages/notifications-page"

export const Route = createFileRoute("/_auth/settings/notifications")({
  validateSearch: settingsTabSearch,
  component: NotificationsPage,
})
