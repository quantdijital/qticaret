import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { TENANT_STATUSES } from "@qticaret/types/control-plane"
import { TenantsPage } from "@/features/tenants/pages/tenants-page"

// The list's view in the address (docs/18 §7): a link, a reload or the back button keeps it
const search = z.object({
  status: z
    .enum(["all", ...TENANT_STATUSES])
    .catch("all")
    .default("all"),
  q: z.string().max(100).catch("").default(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
})

/** The platform's shops (adr/0061 §2): every role reads them. */
export const Route = createFileRoute("/_app/tenants/")({
  validateSearch: search,
  component: TenantsPage,
})
