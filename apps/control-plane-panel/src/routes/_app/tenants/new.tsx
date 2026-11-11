import { createFileRoute, redirect } from "@tanstack/react-router"
import { canManageShops } from "@/features/tenants/permissions"
import { NewTenantPage } from "@/features/tenants/wizard/new-tenant-page"

/** A new shop (C11): who may make one (owner, operator); anyone else goes back to the list. */
export const Route = createFileRoute("/_app/tenants/new")({
  beforeLoad: ({ context }) => {
    if (!canManageShops(context.me.role)) {
      throw redirect({ to: "/tenants" })
    }
  },
  component: () => <NewTenantPage />,
})
