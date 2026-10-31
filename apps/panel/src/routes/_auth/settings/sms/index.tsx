import { createFileRoute, redirect } from "@tanstack/react-router"

// SMS lives on the messages page now (the owner, 2026-10-31): old links land on its tab
export const Route = createFileRoute("/_auth/settings/sms/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/notifications", search: { part: "sms" } })
  },
})
