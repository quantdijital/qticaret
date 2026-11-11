import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { makeTestIdentity, openWithTestIdentity } from "@qticaret/server-kit/testing/age"
import { kekFingerprint } from "@qticaret/server-kit"
import { issueTenantSecrets } from "../../src/lib/vault/tenant-secrets"
import { runKeysCommand } from "../../src/scripts/keys"
import { FLEET_MODULE } from "../../src/modules/fleet"
import type FleetModuleService from "../../src/modules/fleet/service"
import { VAULT_MODULE } from "../../src/modules/vault"
import type VaultModuleService from "../../src/modules/vault/service"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { TEST_TCKN, client, makeTenant, proved } from "../helpers/tenants"
import { captureOutput, formsOf, tablesHolding } from "../helpers/vault"

jest.setTimeout(240 * 1000)

const hex = () => randomBytes(32).toString("hex")

/**
 * adr/0061 §4.1, §4.3, Ek C8: a KEK rotation rewraps every sealed value
 * (secrets and TCKNs) so the old key can go; removing it early strands
 * values and says so. A shop's runtime secrets: its public key and an
 * escrow copy kept, the values back to the caller only, nowhere at rest,
 * in a log or a workflow record; the escrow opens with the offline
 * identity alone.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member
    const original = {
      keks: process.env["CP_MASTER_KEY"],
      recipients: process.env["CP_ESCROW_RECIPIENTS"],
    }

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
    })

    afterEach(() => {
      process.env["CP_MASTER_KEY"] = original.keks
      process.env["CP_ESCROW_RECIPIENTS"] = original.recipients
    })

    const vault = () => getContainer().resolve<VaultModuleService>(VAULT_MODULE)
    const fleet = () => getContainer().resolve<FleetModuleService>(FLEET_MODULE)
    const reveal = async (id: string) =>
      call.post(`/admin/cp/tenants/${id}/reveal-tckn`, {}, owner, await proved(http, owner))

    async function soleProprietor(): Promise<string> {
      const { id } = await makeTenant(http, owner)
      await call.post(
        `/admin/cp/tenants/${id}/company`,
        { kind: "sole_proprietor", tckn: TEST_TCKN },
        owner
      )
      return id
    }

    it("rewraps under a new KEK, after which the old one can go and everything still reads", async () => {
      const [a, b] = [hex(), hex()]
      process.env["CP_MASTER_KEY"] = a
      const shop = await soleProprietor()
      await vault().putSecret({ owner: "platform", name: "probe", value: "probe-value" })

      process.env["CP_MASTER_KEY"] = `${b},${a}`
      const before = (await call.get("/admin/cp/keys", owner)).data as unknown as {
        keks: { pending: number; keks: { kek_id: string; state: string; total: number }[] }
      }
      expect(before.keks.pending).toBe(2)
      expect(before.keks.keks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kek_id: kekFingerprint(Buffer.from(a, "hex")), total: 2 }),
        ])
      )

      const rewrapped = await call.post(
        "/admin/cp/keys/rewrap",
        {},
        owner,
        await proved(http, owner)
      )
      expect(rewrapped.data).toMatchObject({
        rewrapped: 2,
        failed: 0,
        status: { pending: 0, stranded: 0, removable: [kekFingerprint(Buffer.from(a, "hex"))] },
      })
      // A second run finds nothing left
      expect(
        (await call.post("/admin/cp/keys/rewrap", {}, owner, await proved(http, owner))).data
      ).toMatchObject({ rewrapped: 0 })

      process.env["CP_MASTER_KEY"] = b
      expect((await reveal(shop)).data).toEqual({ tckn: TEST_TCKN })
      expect((await vault().openSecret("platform", "probe")).toString("utf8")).toBe("probe-value")
    })

    it("says what a key removed before its rewrap stranded, and the CLI refuses it", async () => {
      const [a, b] = [hex(), hex()]
      process.env["CP_MASTER_KEY"] = a
      const shop = await soleProprietor()

      process.env["CP_MASTER_KEY"] = b
      const status = (await call.get("/admin/cp/keys", owner)).data as unknown as {
        keks: { stranded: number; keks: { state: string }[] }
      }
      const { result: exitCode, output } = await captureOutput(() =>
        runKeysCommand(getContainer(), "status")
      )

      expect(status.keks.stranded).toBe(1)
      expect(status.keks.keks).toEqual(
        expect.arrayContaining([expect.objectContaining({ state: "missing" })])
      )
      expect(exitCode).toBe(1)
      expect(output).toContain("cannot be opened")
      expect((await reveal(shop)).status).toBe(500)

      // Put back after the current one: it reads again and the rewrap moves it
      process.env["CP_MASTER_KEY"] = `${b},${a}`
      expect(await captureOutput(() => runKeysCommand(getContainer(), "rewrap"))).toMatchObject({
        result: 0,
      })
      process.env["CP_MASTER_KEY"] = b
      expect((await reveal(shop)).data).toEqual({ tckn: TEST_TCKN })
    })

    it("issues a shop's secrets: the public key and escrow kept, the values nowhere", async () => {
      const { identity, recipient } = await makeTestIdentity()
      process.env["CP_ESCROW_RECIPIENTS"] = recipient
      const { id } = await makeTenant(http, owner)

      const { result: secrets, output } = await captureOutput(() =>
        issueTenantSecrets(getContainer(), id)
      )
      const needles = Object.values(secrets.values).flatMap(formsOf)

      expect(await fleet().tenantKeys(id)).toEqual([
        expect.objectContaining({ kid: secrets.signing.kid, status: "active" }),
      ])
      const [escrow] = await vault().listSecretEscrows({ tenant_id: id })
      const opened = JSON.parse(await openWithTestIdentity(escrow?.sealed ?? "", identity)) as {
        secrets: Record<string, string>
      }
      expect(opened.secrets).toEqual(secrets.values)
      expect(needles.filter((needle) => output.includes(needle))).toEqual([])
      expect(await tablesHolding(getContainer(), needles)).toEqual([])
      expect(
        await getContainer()
          .resolve(Modules.WORKFLOW_ENGINE)
          .listWorkflowExecutions({ workflow_id: "cp-tenant-keys-record" })
      ).toHaveLength(0)

      // A rotation's new pair waits as `next`, then takes over
      const next = await issueTenantSecrets(getContainer(), id)
      expect((await fleet().tenantKeys(id)).map((key) => key.status)).toEqual(["active", "next"])
      await fleet().promoteTenantKey(id)
      expect((await fleet().tenantKeys(id)).map((key) => [key.kid, key.status])).toEqual([
        [secrets.signing.kid, "retired"],
        [next.signing.kid, "active"],
      ])
      expect((await vault().escrowsOf(id)).map((each) => each.version)).toEqual([2, 1])
    })

    it("undoes the public key when the escrow cannot be recorded, and refuses an unknown shop", async () => {
      const { recipient } = await makeTestIdentity()
      process.env["CP_ESCROW_RECIPIENTS"] = recipient
      const { id } = await makeTenant(http, owner)
      const spy = jest.spyOn(vault(), "recordEscrow").mockRejectedValueOnce(new Error("db down"))
      try {
        // A workflow rejects with the step's error as a plain object
        await expect(issueTenantSecrets(getContainer(), id)).rejects.toMatchObject({
          message: "db down",
        })
      } finally {
        spy.mockRestore()
      }

      expect(await fleet().tenantKeys(id)).toEqual([])
      await expect(issueTenantSecrets(getContainer(), "ten_unknown")).rejects.toMatchObject({
        message: "cp.tenant_unknown",
      })
      expect(await fleet().listTenantKeys({ tenant_id: "ten_unknown" })).toEqual([])
    })
  },
})
