import { createFileRoute } from "@tanstack/react-router"
import { ProductsPage } from "@/features/products/pages/products-page"
import { productListSearchSchema } from "@/features/products/search"

export const Route = createFileRoute("/_auth/products/")({
  validateSearch: productListSearchSchema,
  component: ProductsPage,
})
