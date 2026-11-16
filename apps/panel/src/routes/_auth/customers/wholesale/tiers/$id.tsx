import { createFileRoute, redirect } from "@tanstack/react-router"

// Toptancılar left Müşteriler for its own menu item (the owner, 2026-11-16): old links land there
export const Route = createFileRoute("/_auth/customers/wholesale/tiers/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/wholesale/tiers/$id", params, replace: true })
  },
})
