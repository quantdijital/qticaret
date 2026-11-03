import { createFileRoute } from "@tanstack/react-router"
import { BulkMessagesPage } from "@/features/bulk-messages/pages/bulk-messages-page"
import { bulkMessageSearchSchema } from "@/features/bulk-messages/search"

export const Route = createFileRoute("/_auth/bulk-messages/")({
  validateSearch: bulkMessageSearchSchema,
  component: BulkMessagesPage,
})
