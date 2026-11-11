import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseEnv } from "../../../../lib/env"
import { hostnameAvailability, slugAvailability } from "../../../../lib/tenants/availability"
import { tenantsOf } from "../tenants/params"
import type { GetTenantAvailabilityType } from "../tenants/validators"

/**
 * GET /admin/cp/tenant-availability?slug=&hostname= (owner, operator): a
 * new shop's address checked while it is typed (C11): the slug's format,
 * reserved names and whether a shop has it, the platform host name it
 * makes, and an own domain's format and whether a shop answers on it. Its
 * own path, not under `/tenants/:id`, so the word is never read as a
 * shop's id. Nothing is held by asking; the create route checks again.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetTenantAvailabilityType>,
  res: MedusaResponse
): Promise<void> {
  const { slug, hostname } = req.validatedQuery as GetTenantAvailabilityType
  const domain = parseEnv().PLATFORM_DOMAIN
  const service = tenantsOf(req)
  const lookups = {
    slugTaken: (value: string) => service.slugTaken(value),
    hostTaken: (value: string) => service.hostTaken(value),
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({
    platform_domain: domain,
    ...(slug !== undefined ? { slug: await slugAvailability(slug, domain, lookups) } : {}),
    ...(hostname !== undefined
      ? { hostname: await hostnameAvailability(hostname, domain, lookups) }
      : {}),
  })
}
