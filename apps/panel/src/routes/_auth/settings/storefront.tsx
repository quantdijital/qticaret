import { createFileRoute } from "@tanstack/react-router"
import { StorefrontPage } from "@/features/settings/pages/storefront-page"

export const Route = createFileRoute("/_auth/settings/storefront")({
  component: StorefrontPage,
})
