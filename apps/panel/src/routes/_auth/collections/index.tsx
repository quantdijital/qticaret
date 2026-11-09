import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { CollectionsPage } from "@/features/collections/pages/collections-page"

/** `/collections?q=yaz&page=2` (1-based in the URL). */
const collectionsSearchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export const Route = createFileRoute("/_auth/collections/")({
  validateSearch: collectionsSearchSchema,
  component: CollectionsPage,
})
