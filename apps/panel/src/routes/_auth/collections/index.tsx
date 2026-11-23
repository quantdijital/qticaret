import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { CollectionsGate } from "@/features/collections/components/collections-gate"
import { CollectionsPage } from "@/features/collections/pages/collections-page"

/** `/collections?q=yaz&page=2` (1-based in the URL). */
const collectionsSearchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export const Route = createFileRoute("/_auth/collections/")({
  validateSearch: collectionsSearchSchema,
  // `catalog.collections` off: the "kapalı" state, not the list (the records are kept)
  component: () => (
    <CollectionsGate>
      <CollectionsPage />
    </CollectionsGate>
  ),
})
