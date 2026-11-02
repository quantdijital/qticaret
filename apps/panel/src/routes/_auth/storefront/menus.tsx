import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { MenusPage } from "@/features/storefront/pages/menus-page"

/** `/storefront/menus?menu=smenu_…`: the menu open on the right (adr/0049). */
export const Route = createFileRoute("/_auth/storefront/menus")({
  validateSearch: z.object({ menu: z.string().max(64).optional().catch(undefined) }),
  component: MenusPage,
})
