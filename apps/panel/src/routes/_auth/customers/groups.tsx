import { createFileRoute } from "@tanstack/react-router"
import { CustomerGroupsPage } from "@/features/customers/pages/customer-groups-page"

export const Route = createFileRoute("/_auth/customers/groups")({
  component: CustomerGroupsPage,
})
