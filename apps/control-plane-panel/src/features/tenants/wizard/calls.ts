import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { startRun } from "@/features/provisioning/api"
import { tenantPath } from "@/features/tenants/api"
import { api } from "@/lib/api"
import { withStepUp } from "@/lib/step-up"
import type { SetupCalls } from "./setup-sequence"

/**
 * The control plane's calls behind "Kur" (C11): the record and the setup
 * ask a step-up (one proof covers both: it holds five minutes), the saves
 * in between do not (C7's rules).
 */
export const setupCalls: SetupCalls = {
  createTenant: async (input) =>
    (
      await withStepUp((headers) =>
        api<{ tenant: { id: string } }>("/admin/cp/tenants", {
          method: "POST",
          body: input,
          headers,
        })
      )
    ).tenant,
  saveCompany: (id, input) => api(tenantPath(id, "/company"), { method: "POST", body: input }),
  saveContact: (id, input) => api(tenantPath(id, "/contacts"), { method: "POST", body: input }),
  addDomain: (id, hostname) =>
    api(tenantPath(id, "/domains"), { method: "POST", body: { hostname } }),
  startProvisioning: (id) => startRun(id, "create"),
}

export interface AvailabilityAnswer {
  platform_domain: string
  slug?: { value: string; hostname: string; problem: string | null }
  hostname?: { value: string; problem: string | null }
}

/**
 * A new shop's address asked while typed (`GET /admin/cp/tenant-availability`,
 * owner and operator): the slug and the own domain, each only once it can
 * be one (the page leaves out what fails its own format check).
 */
export const availabilityQuery = (slug: string | null, hostname: string | null) =>
  queryOptions({
    queryKey: ["tenants", "availability", slug, hostname],
    queryFn: () =>
      api<AvailabilityAnswer>("/admin/cp/tenant-availability", {
        query: { slug: slug ?? undefined, hostname: hostname ?? undefined },
      }),
    placeholderData: keepPreviousData,
    staleTime: 5_000,
  })
