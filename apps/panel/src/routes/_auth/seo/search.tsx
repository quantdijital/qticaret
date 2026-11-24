import { createFileRoute, redirect } from "@tanstack/react-router"
import { siteSearchSearchSchema } from "@/features/seo/search"

// A tab of Settings > SEO now (the owner, 2026-11-23): old links land there, filters kept
export const Route = createFileRoute("/_auth/seo/search")({
  validateSearch: siteSearchSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/settings/seo",
      search: { ...search, part: "site-search" },
      replace: true,
    })
  },
})
