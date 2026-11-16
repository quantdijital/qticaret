import { createFileRoute } from "@tanstack/react-router"
import { WholesalersPage } from "@/features/wholesale/pages/wholesalers-page"
import { wholesaleListSearchSchema } from "@/features/wholesale/search"

export const Route = createFileRoute("/_auth/wholesale/")({
  validateSearch: wholesaleListSearchSchema,
  component: WholesalersPage,
})
