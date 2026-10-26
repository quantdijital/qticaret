import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { CONTENT_TABS } from "@/features/content/api/content"
import { ContentListPage } from "@/features/content/pages/content-list-page"

/** `/content?kind=post&q=kupa&page=2` (1-based in the URL; pages are the default; `landing` too). */
const contentSearchSchema = z.object({
  kind: z.enum(CONTENT_TABS).optional().catch(undefined),
  q: z.string().max(200).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export const Route = createFileRoute("/_auth/content/")({
  validateSearch: contentSearchSchema,
  component: ContentListPage,
})
