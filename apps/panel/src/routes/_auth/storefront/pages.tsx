import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { ContentPagesPage } from "@/features/storefront/pages/content-pages-page"

/** `/storefront/pages?q=iade&page=2`: the shop's own pages (1-based page in the URL). */
export const Route = createFileRoute("/_auth/storefront/pages")({
  validateSearch: z.object({
    q: z.string().max(200).optional().catch(undefined),
    page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
  }),
  component: ContentPagesPage,
})
