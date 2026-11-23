import { createFileRoute, redirect } from "@tanstack/react-router"
import { redirectsSearchSchema } from "@/features/seo/search"

// A tab of Settings > SEO now (the owner, 2026-11-23): old links land there, filters kept
export const Route = createFileRoute("/_auth/seo/redirects")({
  validateSearch: redirectsSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/settings/seo",
      search: { ...search, part: "redirects" },
      replace: true,
    })
  },
})
