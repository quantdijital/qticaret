import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { removeE2eReleases } from "../../src/lib/fleet/e2e-fleet"
import { fleetOf } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const COMMIT = "8a128bbe0c3d"

/**
 * Ek C18 review L1: the e2e's release sweep removes a release only when its
 * version has the e2e's shape and an e2e owner account added it, clears a
 * target only on an e2e shop, and keeps a release another shop targets
 * (that shop's row untouched). Over HTTP, the e2e shape is refused only
 * outside development and test (unit test); here it is taken.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let operator: Member

    beforeAll(async () => {
      operator = await makeMember(http, getContainer(), "operator")
    })

    it("removes only the e2e owner's e2e-shaped releases, and only e2e shops' targets", async () => {
      const container = getContainer()
      const fleet = fleetOf(container)
      // The run's temporary owner as e2e-owner.ts makes it (its address shape)
      const [e2eOwner] = await container
        .resolve(Modules.USER)
        .createUsers([{ email: "cp-e2e-1762800000000-a1b2c3@example.com" }])
      const add = (version: string, by: string) =>
        fleet.addRelease({ version, commit: COMMIT, notes: null, created_by: by })
      const ours = await add("0.0.0-e2e.1762800000001", e2eOwner?.id ?? "")
      const staffs = await add("0.0.0-e2e.1762800000002", operator.userId)
      const shared = await add("0.0.0-e2e.1762800000003", e2eOwner?.id ?? "")
      const real = await add("1.9.0", e2eOwner?.id ?? "")
      const e2eShop = await makeTenant(http, operator, { slug: "e2e-1762800000000-abcdef" })
      const realShop = await makeTenant(http, operator)
      const target = (tenantId: string, releaseId: string) =>
        fleet.setTarget({
          tenant_id: tenantId,
          release_id: releaseId,
          actor: operator.userId,
          reason: "Pilot",
        })
      await target(e2eShop.id, ours.id)
      await target(realShop.id, shared.id)

      const sweep = await removeE2eReleases(container)

      expect(sweep.removed).toEqual([ours.version])
      expect(sweep.kept.sort()).toEqual([shared.version, staffs.version].sort())
      const left = (await fleet.releases()).map((each) => each.version).sort()
      expect(left).toEqual([real.version, shared.version, staffs.version].sort())
      const targets = await fleet.targetsOf([e2eShop.id, realShop.id])
      expect(targets.has(e2eShop.id)).toBe(false)
      expect(targets.get(realShop.id)).toMatchObject({
        reason: "Pilot",
        release: { id: shared.id },
      })

      // Over HTTP in a test run the e2e shape is accepted (refused only where the e2e never runs)
      const made = await client(http).post(
        "/admin/cp/releases",
        { version: "0.0.0-e2e.1762800000009", commit: COMMIT },
        operator,
        await proved(http, operator)
      )
      expect(made.status).toBe(200)
    })
  },
})
