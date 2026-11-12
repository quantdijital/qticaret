import type { MedusaContainer } from "@medusajs/framework/types"
import { usagePeriodOf } from "@qticaret/types/control-plane"
import { CP_AUDIT_MODULE } from "../../modules/cp-audit"
import type CpAuditModuleService from "../../modules/cp-audit/service"
import { fleetIn } from "../../workflows/modules"
import { createTenantWorkflow } from "../../workflows/tenants/create-tenant"
import { parseEnv } from "../env"
import { localOnlyProblem } from "../local-only"
import { platformHostname } from "../tenants/hostname"
import { RELEASE_COMMIT, RELEASE_VERSION } from "./releases"

/**
 * The panel's e2e releases (Ek C18, apps/control-plane-panel/e2e): a
 * release the e2e adds through the panel has this version shape, and only
 * this shape is ever removed (releases are otherwise never deleted). The
 * e2e also needs a shop that reports a release, without setting one up: a
 * record (`provisioning`, no package) with one usage report, of the e2e
 * shop's slug shape, removed by `e2e-shop remove(-all)` as any.
 */
export const E2E_RELEASE_VERSION = /^0\.0\.0-e2e\.\d{13}$/

/** A shop record of the e2e's slug that reports `version`/`commit` now; its id. */
export async function makeReportingShop(
  container: MedusaContainer,
  slug: string,
  release: { version: string; commit: string }
): Promise<string> {
  if (!RELEASE_VERSION.test(release.version) || !RELEASE_COMMIT.test(release.commit)) {
    throw new Error("e2e-shop: make <slug> <semver> <commit>")
  }
  const { result } = await createTenantWorkflow(container).run({
    input: {
      name: "Kalem Atölyesi",
      slug,
      hostname: platformHostname(slug, parseEnv().PLATFORM_DOMAIN),
      created_by: null,
      package_id: null,
      sector_pack: null,
    },
  })
  const now = new Date()
  await fleetIn(container).recordUsage(
    {
      version: 1,
      tenant_id: result.id,
      reported_at: now.toISOString(),
      period: usagePeriodOf(now),
      counts: {
        products: 24,
        orders_this_month: 6,
        staff: 2,
        storage_mb: 48,
        llm_credits_this_month: 1,
      },
      last_order_at: null,
      release,
    },
    now
  )
  return result.id
}

/** Every release of the e2e's version shape gone, and any target naming one; their versions. */
export async function removeE2eReleases(container: MedusaContainer): Promise<string[]> {
  const problem = localOnlyProblem(parseEnv())
  if (problem) {
    throw new Error(`e2e-shop: ${problem}`)
  }
  const fleet = fleetIn(container)
  const releases = (await fleet.releases()).filter((each) => E2E_RELEASE_VERSION.test(each.version))
  const targets = await fleet.targets()
  for (const release of releases) {
    for (const target of targets.filter((each) => each.release_id === release.id)) {
      await fleet.forgetTarget(target.tenant_id)
    }
    await fleet.removeRelease(release.id)
    await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
      kind: "system",
      action: "release.e2e_release_removed",
      actor_type: "system",
      resource_type: "release",
      resource_id: release.id,
    })
  }
  return releases.map((each) => each.version)
}
