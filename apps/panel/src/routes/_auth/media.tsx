import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { MEDIA_VIEWS } from "@/features/media/api/media"
import { MediaPage } from "@/features/media/pages/media-page"

/** `/media?view=unused&q=kapak&page=2` (1-based in the URL). */
const mediaSearchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  view: z.enum(MEDIA_VIEWS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export const Route = createFileRoute("/_auth/media")({
  validateSearch: mediaSearchSchema,
  component: MediaPage,
})
