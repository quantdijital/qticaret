import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseEnv } from "../../../../lib/env"
import { listVersions } from "../../../../lib/fleet/release-views"
import { reissuePlanDocuments } from "../../../../lib/fleet/reissue"
import { platformHostname } from "../../../../lib/tenants/hostname"
import type { HealthTarget } from "../../../../modules/fleet/models/health"
import { billingIn, fleetIn } from "../../../../workflows/modules"
import { createTenantWorkflow } from "../../../../workflows/tenants/create-tenant"
import { noteAuditChanges, noteAuditResource } from "../../../http/audit"
import { actorOf, plansOf, tenantsOf } from "./params"
import type { GetTenantsType, PostTenantType } from "./validators"

interface ListRow {
  id: string
  slug: string
  name: string
  status: string
  status_changed_at: Date
  created_at: Date
  domains?: { hostname: string; is_primary: boolean }[]
}

// `%` and `_` typed into the search are letters, not patterns
const likeOf = (q: string) => `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`

/** The shops on a package, when the list is narrowed to one; null when it is not. */
async function onPackage(req: AuthenticatedMedusaRequest, packageId: string | undefined) {
  return packageId ? [...(await plansOf(req).plansOf({ package_id: packageId })).keys()] : null
}

/**
 * GET /admin/cp/tenants (all staff): the shops, newest first, by name or
 * slug, status and package, with each one's primary address and package,
 * and how many are in each status (the list's tabs), and its health
 * standing (Ek C13) and version (Ek C18). No contact here: the list
 * reads no personal data.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetTenantsType>,
  res: MedusaResponse
): Promise<void> {
  const { q, status, package_id, limit, offset } = req.validatedQuery as GetTenantsType
  const ids = await onPackage(req, package_id)
  const service = tenantsOf(req)
  const counts = await service.statusCounts()
  if (ids?.length === 0) {
    res.json({ tenants: [], count: 0, limit, offset, counts })
    return
  }
  const [rows, count] = (await service.listAndCountTenants(
    {
      ...(status ? { status } : {}),
      ...(ids ? { id: ids } : {}),
      ...(q ? { $or: [{ name: { $ilike: likeOf(q) } }, { slug: { $ilike: likeOf(q) } }] } : {}),
    },
    {
      select: [
        "id",
        "slug",
        "name",
        "status",
        "status_changed_at",
        "created_at",
        "domains.hostname",
        "domains.is_primary",
      ],
      relations: ["domains"],
      order: { created_at: "DESC", id: "DESC" },
      skip: offset,
      take: limit,
    }
  )) as unknown as [ListRow[], number]
  const plans = await plansOf(req).plansOf({ tenant_id: rows.map((row) => row.id) })
  const packageIds = [...new Set(plans.values())]
  const packages = packageIds.length > 0 ? await plansOf(req).packages({ id: packageIds }) : []
  const byId = new Map(packages.map((each) => [each.id, each]))
  // Ek C13: each shop's latest standing per probed target, for the list's health column
  const standings = await fleetIn(req.scope).healthOf(rows.map((row) => row.id))
  // Ek C16: each shop's next payment day (its oldest open charge, else its next renewal)
  const nextPayments = await billingIn(req.scope).nextPayments(rows.map((row) => row.id))
  // Ek C18: what each runs (its latest report) and whether that is its target
  const versions = await listVersions(
    req.scope,
    rows.map((row) => row.id)
  )
  const healthOf = (id: string, target: HealthTarget) =>
    standings.find((each) => each.tenant_id === id && each.target === target)?.state ?? null
  res.json({
    tenants: rows.map((row) => {
      const chosen = byId.get(plans.get(row.id) ?? "")
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        status_changed_at: row.status_changed_at,
        created_at: row.created_at,
        primary_hostname: row.domains?.find((each) => each.is_primary)?.hostname ?? null,
        package: chosen ? { id: chosen.id, code: chosen.code, name: chosen.name } : null,
        next_payment_on: nextPayments.get(row.id) ?? null,
        health: {
          backend: healthOf(row.id, "backend"),
          storefront: healthOf(row.id, "storefront"),
        },
        version: versions.get(row.id) ?? { reported: null, target: null, drift: false },
      }
    }),
    count,
    limit,
    offset,
    counts,
  })
}

/**
 * POST /admin/cp/tenants (owner, operator): a new shop as a record
 * (adr/0061 §2): `provisioning`, its subdomain under `PLATFORM_DOMAIN`,
 * optionally its package and sector pack (C11). Bringing it up is the
 * setup's (C10); C11's wizard starts it once the record is filled in.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostTenantType>,
  res: MedusaResponse
): Promise<void> {
  const { name, slug, package_id, sector_pack } = req.validatedBody
  const { result: tenant } = await createTenantWorkflow(req.scope).run({
    input: {
      name,
      slug,
      hostname: platformHostname(slug, parseEnv().PLATFORM_DOMAIN),
      created_by: actorOf(req),
      package_id: package_id ?? null,
      sector_pack: sector_pack ?? null,
    },
  })
  noteAuditResource(req, tenant.id)
  noteAuditChanges(req, { slug: { to: slug }, status: { to: tenant.status } })
  if (package_id) {
    // Its first plan document, kept for its setup (C10) and its first pull (Ek C9)
    await reissuePlanDocuments(req.scope, [tenant.id])
  }
  res.json({ tenant: { id: tenant.id, slug: tenant.slug, status: tenant.status } })
}
