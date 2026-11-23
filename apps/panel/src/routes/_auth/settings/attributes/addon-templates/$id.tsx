import { createFileRoute } from "@tanstack/react-router"
import { AddonTemplatePage } from "@/features/products/addon-templates/addon-template-page"

export const Route = createFileRoute("/_auth/settings/attributes/addon-templates/$id")({
  component: AddonTemplatePage,
})
