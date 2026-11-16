import { createFileRoute, redirect } from "@tanstack/react-router"
import { wholesaleOrderSearchSchema } from "@/features/wholesale/search"

// Toptancılar left Müşteriler for its own menu item (the owner, 2026-11-16): old links land there
export const Route = createFileRoute("/_auth/customers/wholesale/orders")({
  validateSearch: wholesaleOrderSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/wholesale/orders", search, replace: true })
  },
})
