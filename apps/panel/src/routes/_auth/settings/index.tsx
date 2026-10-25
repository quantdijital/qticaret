import { createFileRoute, redirect } from "@tanstack/react-router"

// Settings has no page of its own yet: the first section opens
export const Route = createFileRoute("/_auth/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/appearance" })
  },
})
