import { createFileRoute } from "@tanstack/react-router"
import { GalleryPage } from "@/features/storefront/gallery/gallery-page"

/** `/storefront/looks`: the looks gallery (adr/0064). */
export const Route = createFileRoute("/_auth/storefront/looks")({
  component: GalleryPage,
})
