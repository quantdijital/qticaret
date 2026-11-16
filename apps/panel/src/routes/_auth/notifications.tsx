import { createFileRoute } from "@tanstack/react-router"
import { NotificationsPage } from "@/features/notifications/pages/notifications-page"
import { notificationSearchSchema } from "@/features/notifications/search"

export const Route = createFileRoute("/_auth/notifications")({
  validateSearch: notificationSearchSchema,
  component: NotificationsPage,
})
