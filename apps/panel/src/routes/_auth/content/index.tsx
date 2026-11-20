import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { CONTENT_KIND_SEARCH } from "@/features/content/api/content"
import { ContentListPage } from "@/features/content/pages/content-list-page"

/**
 * `/content?kind=tag&q=kupa&page=2` (1-based in the URL; posts are the
 * default; `landing` too); `kind=page`, the old pages tab, opens the theme
 * editor's content pages (adr/0073 Ek 2026-11-19 (2) K5).
 */
const contentSearchSchema = z.object({
  kind: z.enum(CONTENT_KIND_SEARCH).optional().catch(undefined),
  q: z.string().max(200).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export const Route = createFileRoute("/_auth/content/")({
  validateSearch: contentSearchSchema,
  component: ContentListPage,
})
