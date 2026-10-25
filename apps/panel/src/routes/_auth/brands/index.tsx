import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { BrandsPage } from "@/features/brands/pages/brands-page"

/** `/brands?q=celik&page=2` (1-based in the URL). */
const brandsSearchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export const Route = createFileRoute("/_auth/brands/")({
  validateSearch: brandsSearchSchema,
  component: BrandsPage,
})
