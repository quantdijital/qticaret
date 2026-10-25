import { createFileRoute } from "@tanstack/react-router"
import { ProductWizardPage } from "@/features/products/wizard/product-wizard-page"

export const Route = createFileRoute("/_auth/products/new")({
  component: ProductWizardPage,
})
