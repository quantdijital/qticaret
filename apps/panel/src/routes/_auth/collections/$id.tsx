import { createFileRoute } from "@tanstack/react-router"
import { CollectionPage } from "@/features/collections/pages/collection-page"

export const Route = createFileRoute("/_auth/collections/$id")({
  component: CollectionPage,
})
