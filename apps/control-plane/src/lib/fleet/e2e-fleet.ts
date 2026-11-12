import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { usagePeriodOf } from "@qticaret/types/control-plane"
import { CP_AUDIT_MODULE } from "../../modules/cp-audit"
import type CpAuditModuleService from "../../modules/cp-audit/service"
import { E2E_OWNER_EMAIL } from "../../scripts/e2e-owner"
import { E2E_SHOP_SLUG } from "../../scripts/e2e-shop-slug"
import { fleetIn, tenantsIn } from "../../workflows/modules"
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

/** What the e2e sweep did: the releases it removed, and those it left (not the e2e's own). */
export interface E2eReleaseSweep {
  removed: string[]
  kept: string[]
}

/**
 * The e2e run's releases gone (review L1). A release goes only when its
 * version has the e2e's shape **and** it was added by an e2e owner account
 * (`E2E_OWNER_EMAIL`, the run's temporary owner: the teardown sweeps before
 * it removes the owner). A target naming it is cleared only on an e2e shop
 * (`E2E_SHOP_SLUG`); a release some other shop targets is kept, that shop's
 * row untouched. Only on a developer's machine or in a test run.
 */
export async function removeE2eReleases(container: MedusaContainer): Promise<E2eReleaseSweep> {
  const problem = localOnlyProblem(parseEnv())
  if (problem) {
    throw new Error(`e2e-shop: ${problem}`)
  }
  const fleet = fleetIn(container)
  const shaped = (await fleet.releases()).filter((each) => E2E_RELEASE_VERSION.test(each.version))
  const authors = [...new Set(shaped.map((each) => each.created_by).filter((id) => id !== null))]
  const users = authors.length
    ? await container
        .resolve(Modules.USER)
        .listUsers({ id: authors }, { select: ["id", "email"], take: authors.length })
    : []
  const e2eAuthors = new Set(
    users.filter((user) => E2E_OWNER_EMAIL.test(user.email)).map((user) => user.id)
  )
  const targets = await fleet.targets()
  const targeting = [...new Set(targets.map((each) => each.tenant_id))]
  const slugs = new Map(
    (targeting.length
      ? await tenantsIn(container).listTenants(
          { id: targeting },
          { select: ["id", "slug"], take: targeting.length }
        )
      : []
    ).map((shop) => [shop.id, shop.slug])
  )
  const sweep: E2eReleaseSweep = { removed: [], kept: [] }
  for (const release of shaped) {
    const naming = targets.filter((each) => each.release_id === release.id)
    const others = naming.some((each) => !E2E_SHOP_SLUG.test(slugs.get(each.tenant_id) ?? ""))
    if (!release.created_by || !e2eAuthors.has(release.created_by) || others) {
      sweep.kept.push(release.version)
      continue
    }
    for (const target of naming) {
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
    sweep.removed.push(release.version)
  }
  return sweep
}
