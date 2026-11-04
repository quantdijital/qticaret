import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { MediaPage } from "@/features/media/pages/media-page"

/** `/media?q=kapak&page=2` (1-based in the URL). */
const mediaSearchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export const Route = createFileRoute("/_auth/media")({
  validateSearch: mediaSearchSchema,
  component: MediaPage,
})
