import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeState } from "../../src/lib/provisioning/fake-provisioner"
import { PROVISIONING_MODULE } from "../../src/modules/provisioning"
import type ProvisioningModuleService from "../../src/modules/provisioning/service"
import { ensureSigningKey, packageFor } from "../helpers/fleet"
import { moveThrough, reportAt } from "../helpers/releases"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

interface Step {
  name: string
  status: string
  error_code: string | null
  output: Record<string, unknown> | null
}
interface Run {
  id: string
  kind: string
  status: string
  error_code: string | null
  steps?: Step[]
}
interface Backup {
  status: string
  at: string
  bytes: number | null
  files: boolean | null
  error_code: string | null
  run_id: string
}

const COMMIT = "abcdef1234567890"
const statusOf = (run: Run) =>
  Object.fromEntries((run.steps ?? []).map((step) => [step.name, step.status]))

/**
 * Audit 3.1, 3.2: a shop's backup ("Şimdi yedekle") and its move to its
 * target release ("Sürümü yükselt") as provisioning runs, with the fake
 * provisioner: who may, the step-up, the order of the steps, the refusals
 * (no target, a target ahead of the control plane, a release not built),
 * a failure that stops the run and starts the shop again, and the "Son
 * yedek" on the shop's page and the list.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    const container = (): MedusaContainer => getContainer()
    const runs = () => container().resolve<ProvisioningModuleService>(PROVISIONING_MODULE)
    let owner: Member
    let operator: Member
    let readonly: Member

    beforeAll(async () => {
      owner = await makeMember(http, container(), "owner")
      operator = await makeMember(http, container(), "operator")
      readonly = await makeMember(http, container(), "readonly")
    })

    beforeEach(async () => {
      await ensureSigningKey(container())
      fakeState().failOn = null
      fakeState().built = { version: "0.0.0", commit: COMMIT }
    })

    const base = (id: string) => `/admin/cp/tenants/${id}/provisioning`

    async function finished(tenantId: string, runId: string): Promise<Run> {
      for (let i = 0; i < 200; i++) {
        const run = await runs().runOf(tenantId, runId)
        if (run.status !== "running") {
          const answer = await call.get(`${base(tenantId)}/runs/${runId}`, operator)
          return (answer.data as { run: Run }).run
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("run did not finish")
    }

    async function start(tenantId: string, action: string, member: Member = operator) {
      const answer = await call.post(
        `${base(tenantId)}${action}`,
        {},
        member,
        await proved(http, member)
      )
      expect(answer.status).toBe(202)
      return await finished(tenantId, (answer.data as { run: Run }).run.id)
    }

    /** A shop set up and active (the fake's database and process), on no target yet. */
    async function liveShop() {
      const packageId = await packageFor(container(), `paket-${String(Date.now())}`)
      const tenant = await makeTenant(http, operator, { package_id: packageId })
      const setup = await start(tenant.id, "")
      expect(setup.status).toBe("succeeded")
      return tenant
    }

    async function target(tenantId: string, version: string) {
      const added = await call.post(
        "/admin/cp/releases",
        { version, commit: COMMIT },
        owner,
        await proved(http, owner)
      )
      const id =
        added.status === 200
          ? (added.data as { release: { id: string } }).release.id
          : (
              (await call.get("/admin/cp/releases", owner)).data as {
                releases: { id: string; version: string }[]
              }
            ).releases.find((each) => each.version === version)?.id
      const set = await call.post(
        `/admin/cp/tenants/${tenantId}/target-release`,
        { release_id: id, reason: "Yeni sürüme geçiş" },
        owner,
        await proved(http, owner)
      )
      expect(set.status).toBe(200)
    }

    const backupOf = async (tenantId: string) =>
      (
        (await call.get(`/admin/cp/tenants/${tenantId}`, readonly)).data as {
          backup: Backup | null
        }
      ).backup

    const listBackupOf = async (tenantId: string) =>
      (
        (await call.get("/admin/cp/tenants?limit=100", readonly)).data as {
          tenants: { id: string; backup: Backup | null }[]
        }
      ).tenants.find((each) => each.id === tenantId)?.backup

    it("lets only owners and operators start them, each behind a fresh proof", async () => {
      const shop = await liveShop()
      for (const action of ["/backup", "/upgrade"]) {
        expect((await call.post(`${base(shop.id)}${action}`, {}, readonly)).status).toBe(403)
        expect((await call.post(`${base(shop.id)}${action}`, {}, operator)).status).toBe(428)
        expect((await call.post(`${base(shop.id)}${action}`, {}, owner)).status).toBe(428)
        // Nothing but the path
        expect(
          (await call.post(`${base(shop.id)}${action}`, { x: 1 }, owner, await proved(http, owner)))
            .status
        ).toBe(400)
      }
    })

    it("backs a shop up and shows its latest backup on its page and the list", async () => {
      const shop = await liveShop()
      expect(await backupOf(shop.id)).toBeNull()
      const run = await start(shop.id, "/backup", owner)
      expect(run).toMatchObject({ kind: "backup", status: "succeeded", error_code: null })
      const step = run.steps?.find((each) => each.name === "backup")
      expect(step?.output).toMatchObject({ bytes: 4096, files: true, seconds: 1 })
      expect(String(step?.output?.["dump_sha256"])).toMatch(/^[0-9a-f]{64}$/)

      const seen = await backupOf(shop.id)
      expect(seen).toMatchObject({ status: "succeeded", bytes: 4096, files: true, run_id: run.id })
      expect(new Date(seen?.at ?? 0).getTime()).toBeGreaterThan(Date.now() - 60_000)
      expect(await listBackupOf(shop.id)).toEqual(seen)

      // A failed one is the latest: its code, no size
      fakeState().failOn = "backup"
      const failed = await start(shop.id, "/backup")
      expect(failed).toMatchObject({ status: "failed", error_code: "provisioning.fake_failure" })
      expect(await backupOf(shop.id)).toMatchObject({
        status: "failed",
        bytes: null,
        error_code: "provisioning.fake_failure",
      })
      const rows = await auditRows(container(), { resource_id: shop.id })
      expect(rows.some((row) => JSON.stringify(row).includes("/provisioning/backup"))).toBe(true)
    })

    it("upgrades a shop to its target: checked, backed up, stopped, migrated, started, healthy", async () => {
      const shop = await liveShop()
      await reportAt(container(), shop.id, new Date(), { version: "0.0.0", commit: "1111111" })
      const before = fakeState().calls.length
      await target(shop.id, "0.0.0")
      const run = await start(shop.id, "/upgrade", owner)
      expect(run).toMatchObject({ kind: "upgrade", status: "succeeded", error_code: null })
      expect(statusOf(run)).toEqual({
        release: "succeeded",
        backup: "succeeded",
        upgrade_stop: "succeeded",
        migrate: "succeeded",
        upgrade_start: "succeeded",
        health: "succeeded",
      })
      expect(run.steps?.find((step) => step.name === "release")?.output).toMatchObject({
        from: "0.0.0",
        from_commit: "1111111",
        to: "0.0.0",
        to_commit: COMMIT.slice(0, 12),
      })
      // In this order: the backup before the shop goes down, the migrations while it is down
      const calls = fakeState()
        .calls.slice(before)
        .filter((name) => ["backup", "stop", "runTenantCommand:migrate", "start"].includes(name))
      expect(calls).toEqual(["backup", "stop", "runTenantCommand:migrate", "start"])
      expect(fakeState().shops.get(shop.id)).toMatchObject({ running: true })
      expect(await backupOf(shop.id)).toMatchObject({ status: "succeeded", run_id: run.id })
    })

    it("refuses with a reason: no target, a target ahead of the control plane, a release not built", async () => {
      const shop = await liveShop()
      const noTarget = await start(shop.id, "/upgrade")
      expect(noTarget).toMatchObject({
        status: "failed",
        error_code: "provisioning.no_target_release",
      })
      expect(statusOf(noTarget)).toMatchObject({ release: "failed", backup: "pending" })

      // adr/0061 Ek C21: the control plane (0.0.0 here) first
      await target(shop.id, "0.1.0")
      fakeState().built = { version: "0.1.0", commit: COMMIT }
      expect(await start(shop.id, "/upgrade")).toMatchObject({
        status: "failed",
        error_code: "provisioning.release_ahead_of_control_plane",
      })

      await target(shop.id, "0.0.0")
      fakeState().built = { version: "0.0.0", commit: "9999999" }
      const notBuilt = await start(shop.id, "/upgrade")
      expect(notBuilt.error_code).toBe("provisioning.release_not_built")
      // Nothing was touched: still running, no backup taken
      expect(fakeState().shops.get(shop.id)).toMatchObject({ running: true, backups: [] })
    })

    it("stops at a failed migration, leaves the shop stopped and keeps the backup", async () => {
      const shop = await liveShop()
      await target(shop.id, "0.0.0")
      fakeState().failOn = "runTenantCommand:migrate"
      const run = await start(shop.id, "/upgrade")
      expect(run).toMatchObject({ status: "failed", error_code: "provisioning.fake_failure" })
      expect(statusOf(run)).toEqual({
        release: "succeeded",
        backup: "succeeded",
        upgrade_stop: "succeeded",
        migrate: "failed",
        upgrade_start: "pending",
        health: "pending",
      })
      // Review M2: never the new code on a half-migrated database
      expect(fakeState().shops.get(shop.id)).toMatchObject({ running: false })
      expect(fakeState().shops.get(shop.id)?.backups).toHaveLength(1)
    })

    it("never brings up a shop stopped on purpose", async () => {
      const shop = await liveShop()
      await target(shop.id, "0.0.0")
      expect((await start(shop.id, "/stop")).status).toBe("succeeded")
      const run = await start(shop.id, "/upgrade")
      expect(run.error_code).toBe("provisioning.shop_not_running")
      expect(fakeState().shops.get(shop.id)).toMatchObject({ running: false, backups: [] })
    })

    it("upgrades only a shop that sells or keeps running; backs up a suspended one", async () => {
      const packageId = await packageFor(container(), `paket-${String(Date.now())}`)
      const fresh = await makeTenant(http, operator, { package_id: packageId })
      const refused = await call.post(
        `${base(fresh.id)}/upgrade`,
        {},
        operator,
        await proved(http, operator)
      )
      expect(refused.status).toBe(409)
      expect(refused.data).toMatchObject({ message: "provisioning.tenant_status" })

      const shop = await liveShop()
      await moveThrough(container(), shop.id, ["suspended"])
      expect((await start(shop.id, "/backup")).status).toBe("succeeded")
    })
  },
})
