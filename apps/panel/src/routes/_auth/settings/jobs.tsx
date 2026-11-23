import { createFileRoute, redirect } from "@tanstack/react-router"

// İşler became a tab of Denetim kaydı (the owner, 2026-11-23): old links land there
export const Route = createFileRoute("/_auth/settings/jobs")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/audit", search: { part: "jobs" }, replace: true })
  },
})
