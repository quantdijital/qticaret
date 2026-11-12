import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { parseEnv } from "../lib/env"
import { localOnlyProblem } from "../lib/local-only"
import { provisioner } from "../lib/provisioning/provider"
import { ProvisioningError } from "../lib/provisioning/provisioner"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import { fleetIn, plansIn, provisioningIn, tenantsIn, vaultIn } from "../workflows/modules"
import { contextOf } from "../workflows/provisioning/target"

/**
 * The control plane panel's e2e shops (C11, apps/control-plane-panel/e2e):
 * a shop the wizard made through the panel, removed again after the run
 * with everything the setup made for it: its process stopped, its
 * database, role and env file dropped by the provisioner (which itself
 * refuses another shop's, Ek C10 L1), and its records in every module
 * (runs, keys, escrow, plan documents, package, the record with its
 * company, contacts and domains). Only on a developer's machine and only
 * for the slug shape the e2e makes, so no real shop is ever touched. Its
 * audit rows stay (append-only).
 */

export const E2E_SHOP_SLUG = /^e2e-\d{13}-[0-9a-f]{6}$/

export class E2eShopError extends Error {
  override readonly name = "E2eShopError"
}

export function checkE2eSlug(slug: string, env = parseEnv()): void {
  const problem = localOnlyProblem(env)
  if (problem) {
    throw new E2eShopError(`e2e-shop: ${problem}`)
  }
  if (!E2E_SHOP_SLUG.test(slug)) {
    throw new E2eShopError("e2e-shop: not an e2e shop's slug")
  }
}

/** What the provisioner made for it (nothing when the setup never got a port). */
async function dropMade(container: MedusaContainer, tenantId: string): Promise<void> {
  let target
  try {
    ;({ target } = await contextOf(container, tenantId))
  } catch (error) {
    if (error instanceof ProvisioningError && error.code === "provisioning.no_port") {
      return
    }
    throw error
  }
  const made = provisioner()
  await made.stop(target)
  await made.dropDatabase(target)
  await made.removeRuntimeSecrets(target)
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id)

/** The e2e shop gone, everything it had with it; false when there was none. */
export async function removeE2eShop(container: MedusaContainer, slug: string): Promise<boolean> {
  checkE2eSlug(slug)
  const [tenant] = await tenantsIn(container).listTenants({ slug }, { take: 1, select: ["id"] })
  if (!tenant) {
    return false
  }
  const id = tenant.id
  await dropMade(container, id)
  const runs = provisioningIn(container)
  const runIds = ids(await runs.listProvisioningRuns({ tenant_id: id }, { select: ["id"] }))
  if (runIds.length > 0) {
    await runs.deleteProvisioningSteps(
      ids(await runs.listProvisioningSteps({ run_id: runIds }, { select: ["id"] }))
    )
    await runs.deleteProvisioningRuns(runIds)
  }
  const fleet = fleetIn(container)
  await fleet.deleteTenantKeys(
    ids(await fleet.listTenantKeys({ tenant_id: id }, { select: ["id"] }))
  )
  await fleet.deletePlanDocuments(
    ids(await fleet.listPlanDocuments({ tenant_id: id }, { select: ["id"] }))
  )
  // Ek C13: its usage snapshots, probes and standings
  await fleet.forgetMonitoring(id)
  // Ek C18: its target release
  await fleet.forgetTarget(id)
  const vault = vaultIn(container)
  await vault.deleteSecretRecords(
    ids(await vault.listSecretRecords({ owner: id }, { select: ["id"] }))
  )
  await vault.deleteSecretEscrows(
    ids(await vault.listSecretEscrows({ tenant_id: id }, { select: ["id"] }))
  )
  const plans = plansIn(container)
  await plans.deleteTenantPlans(
    ids(await plans.listTenantPlans({ tenant_id: id }, { select: ["id"] }))
  )
  await plans.deleteTenantOverrides(
    ids(await plans.listTenantOverrides({ tenant_id: id }, { select: ["id"] }))
  )
  await plans.deleteTenantFeatureOverrides(
    ids(await plans.listTenantFeatureOverrides({ tenant_id: id }, { select: ["id"] }))
  )
  await tenantsIn(container).deleteTenants([id])
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action: "tenant.e2e_shop_removed",
    actor_type: "system",
    resource_type: "tenant",
    resource_id: id,
  })
  return true
}

/** Every shop an e2e run left (its slug shape), for the run's teardown. */
export async function e2eShopSlugs(container: MedusaContainer): Promise<string[]> {
  const rows = await tenantsIn(container).listTenants(
    { slug: { $like: "e2e-%" } },
    { select: ["slug"], take: 100 }
  )
  return rows.map((row) => row.slug).filter((slug) => E2E_SHOP_SLUG.test(slug))
}

/**
 * `NODE_ENV=development CP_PROVISIONER=local medusa exec ./src/scripts/e2e-shop.ts remove <slug>`
 * or `… remove-all` (every shop of the e2e's slug shape). Prints slugs only.
 */
export default async function e2eShop({ container, args }: ExecArgs) {
  const [action = "", slug = ""] = args
  if (action === "remove") {
    const removed = await removeE2eShop(container, slug)
    process.stdout.write(`e2e-shop: ${removed ? "removed" : "none"} ${slug}\n`)
  } else if (action === "remove-all") {
    for (const each of await e2eShopSlugs(container)) {
      await removeE2eShop(container, each)
      process.stdout.write(`e2e-shop: removed ${each}\n`)
    }
  } else {
    throw new E2eShopError("e2e-shop: remove <slug> | remove-all")
  }
}
