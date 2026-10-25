import { createFileRoute } from "@tanstack/react-router"
import { CustomersPage } from "@/features/customers/pages/customers-page"
import { customerListSearchSchema } from "@/features/customers/search"

export const Route = createFileRoute("/_auth/customers/")({
  validateSearch: customerListSearchSchema,
  component: CustomersPage,
})
