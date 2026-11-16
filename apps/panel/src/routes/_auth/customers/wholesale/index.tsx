import { createFileRoute, redirect } from "@tanstack/react-router"
import { wholesaleListSearchSchema } from "@/features/wholesale/search"

// Toptancılar left Müşteriler for its own menu item (the owner, 2026-11-16): old links land there
export const Route = createFileRoute("/_auth/customers/wholesale/")({
  validateSearch: wholesaleListSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/wholesale", search, replace: true })
  },
})
