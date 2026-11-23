import { createFileRoute } from "@tanstack/react-router"
import { GalleryPage } from "@/features/storefront/gallery/gallery-page"
import { LooksGate } from "@/features/storefront/gallery/looks-gate"

/** `/storefront/looks`: the looks gallery (adr/0064), the owner's alone (2026-11-23). */
export const Route = createFileRoute("/_auth/storefront/looks")({
  component: () => (
    <LooksGate>
      <GalleryPage />
    </LooksGate>
  ),
})
