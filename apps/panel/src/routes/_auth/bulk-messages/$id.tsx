import { createFileRoute } from "@tanstack/react-router"
import { BulkMessagePage } from "@/features/bulk-messages/pages/bulk-message-page"

export const Route = createFileRoute("/_auth/bulk-messages/$id")({
  component: BulkMessagePage,
})
