import { createFileRoute, redirect } from "@tanstack/react-router"

// Ekip became a tab of Güvenlik (the owner, 2026-11-23): old links land there
export const Route = createFileRoute("/_auth/settings/team")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/security", search: { part: "team" }, replace: true })
  },
})
