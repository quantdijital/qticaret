import { createFileRoute } from "@tanstack/react-router"
import { CollectionsGate } from "@/features/collections/components/collections-gate"
import { CollectionPage } from "@/features/collections/pages/collection-page"

export const Route = createFileRoute("/_auth/collections/$id")({
  // `catalog.collections` off: the "kapalı" state, not the page (the records are kept)
  component: () => (
    <CollectionsGate>
      <CollectionPage />
    </CollectionsGate>
  ),
})
