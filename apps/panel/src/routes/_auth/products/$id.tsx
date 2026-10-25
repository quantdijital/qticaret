import { createFileRoute } from "@tanstack/react-router"
import { ProductDetailPage } from "@/features/products/pages/product-detail-page"

export const Route = createFileRoute("/_auth/products/$id")({
  component: ProductDetailPage,
})
