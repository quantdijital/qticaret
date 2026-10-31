import { createFileRoute, redirect } from "@tanstack/react-router"

// Warehouses live on the shipping page now (the owner, 2026-10-31): old links land on its tab
export const Route = createFileRoute("/_auth/settings/locations")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/shipping", search: { part: "locations" } })
  },
})
