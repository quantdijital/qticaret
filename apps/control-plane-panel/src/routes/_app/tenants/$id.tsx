import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { TenantPage } from "@/features/tenants/pages/tenant-page"

/** One shop; its open tab in the address (`?part=`). */
export const Route = createFileRoute("/_app/tenants/$id")({
  validateSearch: z.object({ part: z.string().max(20).optional().catch(undefined) }),
  component: TenantPage,
})
