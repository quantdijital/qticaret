import { createFileRoute, redirect } from "@tanstack/react-router"

// SEO moved under Settings, in tabs (the owner, 2026-11-23): old links land on its overview
export const Route = createFileRoute("/_auth/seo/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/seo", search: { part: "overview" }, replace: true })
  },
})
