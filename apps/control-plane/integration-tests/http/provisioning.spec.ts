import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeState } from "../../src/lib/provisioning/fake-provisioner"
import { startRun } from "../../src/lib/provisioning/runs"
import { PROVISIONING_MODULE } from "../../src/modules/provisioning"
import type ProvisioningModuleService from "../../src/modules/provisioning/service"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { VAULT_MODULE } from "../../src/modules/vault"
import type VaultModuleService from "../../src/modules/vault/service"
import { ensureSigningKey, fleetOf, packageFor } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, makeTenant, proved } from "../helpers/tenants"
import { captureOutput, formsOf, tablesHolding } from "../helpers/vault"

jest.setTimeout(240 * 1000)

interface Step {
  name: string
  status: string
  created: boolean
  error_code: string | null
  output: Record<string, unknown> | null
}
interface Run {
  id: string
  kind: string
  status: string
  error_code: string | null
  port: number | null
  steps?: Step[]
}

const statusOf = (run: Run) =>
  Object.fromEntries((run.steps ?? []).map((step) => [step.name, step.status]))

/**
 * adr/0061 §6, Ek C10: a shop's setup run through the API with the fake
 * provisioner. Every step recorded; a run again skips what is there; a
 * failure undoes what the run made and nothing else; no secret, link or
 * address in a run, a row, the audit log or the logs.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    const container = (): MedusaContainer => getContainer()
    const runs = () => container().resolve<ProvisioningModuleService>(PROVISIONING_MODULE)
    const tenants = () => container().resolve<TenantsModuleService>(TENANTS_MODULE)
    let owner: Member
    let operator: Member
    let finance: Member
    let readonly: Member
    let mail: Server
    const mailed: { to: string; text: string }[] = []

    beforeAll(async () => {
      owner = await makeMember(http, container(), "owner")
      operator = await makeMember(http, container(), "operator")
      finance = await makeMember(http, container(), "finance")
      readonly = await makeMember(http, container(), "readonly")
      // A stand-in Mailpit: what the control plane sends, kept for the test
      mail = createServer((req, res) => {
        let body = ""
        req.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")))
        req.on("end", () => {
          const sent = JSON.parse(body) as { To: { Email: string }[]; Text: string }
          mailed.push({ to: sent.To[0]?.Email ?? "", text: sent.Text })
          res.writeHead(200, { "content-type": "application/json" }).end("{}")
        })
      })
      await new Promise<void>((resolve) => mail.listen(0, "127.0.0.1", resolve))
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: `http://127.0.0.1:${String((mail.address() as AddressInfo).port)}`,
        EMAIL_FROM: "destek@quantticaret.test",
      })
    })

    afterAll(async () => {
      for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
        process.env[name] = ""
      }
      await new Promise((resolve) => mail.close(resolve))
    })

    beforeEach(async () => {
      await ensureSigningKey(container())
      fakeState().failOn = null
    })

    /** A shop on a package with an owner contact: its id. */
    async function shop(email = `sahip-${String(Date.now())}@example.com`) {
      const packageId = await packageFor(container(), `paket-${String(Date.now())}`)
      const tenant = await makeTenant(http, operator, { package_id: packageId })
      await tenants().saveContact(tenant.id, null, {
        name: "Ayşe Yılmaz",
        role: "owner",
        email,
        phone: null,
      })
      return { ...tenant, email }
    }

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

    async function start(tenantId: string, action = "", member: Member = operator) {
      const answer = await call.post(
        `${base(tenantId)}${action}`,
        {},
        member,
        await proved(http, member)
      )
      expect(answer.status).toBe(202)
      return await finished(tenantId, (answer.data as { run: Run }).run.id)
    }

    it("lets owners and operators read and start runs, with a fresh proof to start", async () => {
      const made = await shop()
      expect((await call.get(base(made.id), finance)).status).toBe(403)
      expect((await call.get(base(made.id), readonly)).status).toBe(403)
      expect((await call.post(base(made.id), {}, finance)).status).toBe(403)
      expect((await call.post(base(made.id), {}, operator)).status).toBe(428)
      expect((await call.post(`${base(made.id)}/stop`, {}, owner)).status).toBe(428)
      const read = await call.get(base(made.id), owner)
      expect(read.status).toBe(200)
      expect(read.data).toMatchObject({ provisioner: "fake", latest: null, runs: [] })
      // Nothing but the path: a body (a failure to inject, say) is refused
      expect(
        (
          await call.post(
            base(made.id),
            { fail_at: "secrets" },
            operator,
            await proved(http, operator)
          )
        ).status
      ).toBe(400)
    })

    it("sets a shop up step by step, keeps no secret or link, and a run again changes nothing", async () => {
      const made = await shop()
      const { result: first, output } = await captureOutput(() => start(made.id))
      expect(first).toMatchObject({ kind: "create", status: "succeeded", error_code: null })
      expect(first.port).toBeGreaterThanOrEqual(9200)
      expect(statusOf(first)).toEqual({
        allocate: "succeeded",
        secrets: "succeeded",
        database: "succeeded",
        migrate: "succeeded",
        bootstrap: "succeeded",
        sector_pack: "skipped",
        plan_document: "succeeded",
        start: "succeeded",
        health: "succeeded",
        api_url: "succeeded",
        owner_invite: "succeeded",
        activate: "succeeded",
      })
      const tenant = await tenants().tenantOf(made.id)
      expect(tenant.status).toBe("active")
      expect(tenant.api_base_url).toBe(`http://localhost:${String(first.port)}`)
      const keys = await fleetOf(container()).tenantKeys(made.id)
      expect(keys.map((key) => key.status)).toEqual(["active"])
      const escrows = await container().resolve<VaultModuleService>(VAULT_MODULE).escrowsOf(made.id)
      expect(escrows).toHaveLength(1)

      const fake = fakeState().shops.get(made.id)
      expect(fake).toMatchObject({ database: true, running: true })
      expect(fake?.imported.length).toBeGreaterThan(0)
      expect(fake?.invites).toHaveLength(1)
      const link = fake?.invites[0] ?? ""
      expect(mailed.filter((each) => each.to === made.email)).toHaveLength(1)
      expect(mailed.find((each) => each.to === made.email)?.text).toContain(link)

      // Nowhere at rest, in the run's answer or in the logs: the secrets, the link, the address
      const secrets = Object.values(fake?.secrets ?? {}).flatMap(formsOf)
      const token = new URL(link).hash.slice("#token=".length)
      expect(secrets.length).toBeGreaterThan(5)
      expect(await tablesHolding(container(), [...secrets, token])).toEqual([])
      const answer = JSON.stringify(first)
      for (const needle of [...secrets, token, made.email]) {
        expect(answer).not.toContain(needle)
        expect(output).not.toContain(needle)
      }
      const rows = await auditRows(container(), { resource_id: made.id })
      expect(JSON.stringify(rows)).not.toContain(token)

      // Again: everything is there, nothing is made, no second mail
      const again = await start(made.id)
      expect(again.status).toBe("succeeded")
      expect(again.port).toBe(first.port)
      expect(again.steps?.filter((step) => step.created)).toEqual([])
      expect(statusOf(again)).toMatchObject({
        secrets: "skipped",
        database: "skipped",
        start: "skipped",
        api_url: "skipped",
        owner_invite: "skipped",
        activate: "skipped",
      })
      expect(await fleetOf(container()).tenantKeys(made.id)).toHaveLength(1)
      expect(fakeState().shops.get(made.id)?.invites).toHaveLength(1)
    })

    it("undoes what the failed run made, and a retry from the start finishes it", async () => {
      const made = await shop()
      fakeState().failOn = "runTenantCommand:bootstrap"
      const failed = await start(made.id)
      expect(failed).toMatchObject({ status: "failed", error_code: "provisioning.fake_failure" })
      expect(statusOf(failed)).toMatchObject({
        allocate: "succeeded",
        secrets: "compensated",
        database: "compensated",
        migrate: "succeeded",
        bootstrap: "failed",
        sector_pack: "pending",
        activate: "pending",
      })
      expect(fakeState().shops.get(made.id)).toMatchObject({ database: false, secrets: null })
      expect(await fleetOf(container()).tenantKeys(made.id)).toEqual([])
      expect(
        await container().resolve<VaultModuleService>(VAULT_MODULE).escrowsOf(made.id)
      ).toEqual([])
      expect((await tenants().tenantOf(made.id)).status).toBe("provisioning")

      const retried = await start(made.id)
      expect(retried.status).toBe("succeeded")
      expect(retried.port).toBe(failed.port)
      expect((await tenants().tenantOf(made.id)).status).toBe("active")
    })

    it("stops a started shop and undoes its address when a late step fails", async () => {
      const made = await shop()
      const { done } = await startRun(container(), {
        tenant_id: made.id,
        kind: "create",
        requested_by: null,
        fail_at: "owner_invite",
      })
      const failed = await done
      expect(failed).toMatchObject({
        status: "failed",
        error_code: "provisioning.injected_failure",
      })
      expect(Object.fromEntries((failed.steps ?? []).map((s) => [s.name, s.status]))).toMatchObject(
        {
          start: "compensated",
          api_url: "compensated",
          database: "compensated",
          secrets: "compensated",
          owner_invite: "failed",
        }
      )
      expect(fakeState().shops.get(made.id)).toMatchObject({ running: false, database: false })
      expect((await tenants().tenantOf(made.id)).api_base_url).toBeNull()
    })

    it("refuses a shop without a package before making anything", async () => {
      const tenant = await makeTenant(http, operator)
      const run = await start(tenant.id)
      expect(run).toMatchObject({ status: "failed", error_code: "provisioning.no_package" })
      expect(statusOf(run)).toMatchObject({ allocate: "failed", secrets: "pending" })
      expect(fakeState().shops.get(tenant.id)?.secrets ?? null).toBeNull()
      expect(await fleetOf(container()).tenantKeys(tenant.id)).toEqual([])
    })

    it("stops and starts the shop, sends the invitation again, one run at a time", async () => {
      const made = await shop()
      await start(made.id)
      const stopped = await start(made.id, "/stop", owner)
      expect(stopped).toMatchObject({ kind: "stop", status: "succeeded" })
      expect(fakeState().shops.get(made.id)?.running).toBe(false)
      const started = await start(made.id, "/start")
      expect(statusOf(started)).toEqual({
        start: "succeeded",
        health: "succeeded",
        api_url: "skipped",
      })

      const resent = await start(made.id, "/invite")
      expect(statusOf(resent)).toEqual({ resend_invite: "succeeded" })
      expect(fakeState().shops.get(made.id)?.invites).toHaveLength(2)
      expect(mailed.filter((each) => each.to === made.email)).toHaveLength(2)

      // Another run under way: 409; one gone silent is closed as interrupted
      const open = await runs().openRun({
        tenant_id: made.id,
        kind: "stop",
        provider: "fake",
        requested_by: null,
        steps: ["stop"],
      })
      const busy = await call.post(
        `${base(made.id)}/stop`,
        {},
        operator,
        await proved(http, operator)
      )
      expect(busy.status).toBe(409)
      expect(busy.data).toMatchObject({ message: "cp.provisioning_busy" })
      await runs().updateProvisioningRuns({
        id: open.id,
        heartbeat_at: new Date(Date.now() - 3_600_000),
      })
      expect((await start(made.id, "/stop")).status).toBe("succeeded")
      expect((await runs().runOf(made.id, open.id)).error_code).toBe("provisioning.interrupted")
    })

    it("answers 404 for another shop's run and 503 without a provisioner", async () => {
      const one = await shop()
      const other = await shop(`baska-${String(Date.now())}@example.com`)
      const run = await start(one.id, "/stop")
      expect((await call.get(`${base(other.id)}/runs/${run.id}`, operator)).status).toBe(404)
      process.env["CP_PROVISIONER"] = ""
      try {
        const answer = await call.post(base(one.id), {}, operator, await proved(http, operator))
        expect(answer.status).toBe(503)
        expect(answer.data).toMatchObject({ message: "cp.provisioner_unavailable" })
      } finally {
        process.env["CP_PROVISIONER"] = "fake"
      }
    })
  },
})
