import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reissuePlanDocuments, tenantsOnPackage } from "../../../../lib/fleet/reissue"
import type { PackageRecord } from "../../../../modules/plans/types"
import { updatePackageWorkflow } from "../../../../workflows/plans/packages"
import type { UpdatePackageInput } from "../../../../workflows/plans/packages"
import { noteAuditChanges } from "../../../http/audit"
import { paramOf, plansOf } from "../tenants/params"

/**
 * A package's change as the audit row keeps it: `{ from, to }` for each
 * field and limit that moved (no personal data in a package).
 */
export function packageChanges(
  before: PackageRecord,
  after: PackageRecord
): Record<string, { from: unknown; to: unknown }> {
  const moved: Record<string, { from: unknown; to: unknown }> = {}
  for (const field of ["name", "price", "period", "trial_days", "grace_days"] as const) {
    if (before[field] !== after[field]) {
      moved[field] = { from: before[field], to: after[field] }
    }
  }
  if ((before.archived_at === null) !== (after.archived_at === null)) {
    moved["archived"] = { from: before.archived_at !== null, to: after.archived_at !== null }
  }
  for (const [key, value] of Object.entries(after.limits)) {
    const was = before.limits[key as keyof PackageRecord["limits"]]
    if (was !== value) {
      moved[`limits.${key}`] = { from: was, to: value }
    }
  }
  // A flag without a value is the default: recorded as null
  for (const key of new Set([...Object.keys(before.features), ...Object.keys(after.features)])) {
    const was = before.features[key] ?? null
    const now = after.features[key] ?? null
    if (was !== now) {
      moved[`features.${key}`] = { from: was, to: now }
    }
  }
  return moved
}

/** Runs a change of the `:id` package and records what moved; answers the package as it is now. */
export async function changePackage(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  change: Omit<UpdatePackageInput, "id">
): Promise<void> {
  const id = (await plansOf(req).packageOf(paramOf(req, "id"))).id
  const { result: before } = await updatePackageWorkflow(req.scope).run({
    input: { id, ...change },
  })
  const after = await plansOf(req).packageOf(id)
  noteAuditChanges(req, packageChanges(before, after))
  // Its shops' documents follow (Ek C9); a price alone changes none of them yet (C16)
  await reissuePlanDocuments(req.scope, await tenantsOnPackage(req.scope, id))
  res.json({ plan: after })
}
