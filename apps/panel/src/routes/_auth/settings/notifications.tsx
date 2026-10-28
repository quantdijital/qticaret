import { createFileRoute } from "@tanstack/react-router"
import { NotificationsPage } from "@/features/settings/pages/notifications-page"

export const Route = createFileRoute("/_auth/settings/notifications")({
  component: NotificationsPage,
})
