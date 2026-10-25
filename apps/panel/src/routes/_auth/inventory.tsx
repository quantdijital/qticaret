import { createFileRoute } from "@tanstack/react-router"
import { InventoryPage } from "@/features/inventory/pages/inventory-page"
import { stockSearchSchema } from "@/features/inventory/search"

export const Route = createFileRoute("/_auth/inventory")({
  validateSearch: stockSearchSchema,
  component: InventoryPage,
})
