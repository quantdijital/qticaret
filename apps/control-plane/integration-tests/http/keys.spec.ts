import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { parsePublicKeys, verifyDocument } from "@qticaret/server-kit"
import { signPlanDocument } from "../../src/lib/vault/signing"
import { VAULT_MODULE } from "../../src/modules/vault"
import type VaultModuleService from "../../src/modules/vault/service"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, proved } from "../helpers/tenants"
import { formsOf, tablesHolding } from "../helpers/vault"

jest.setTimeout(240 * 1000)

const K = "/admin/cp/keys"
const CHANGES = [
  `${K}/rewrap`,
  `${K}/signing/prepare`,
  `${K}/signing/switch`,
  `${K}/signing/retire`,
]

interface Overview {
  signing_keys: { kid: string; status: string; public_key: string }[]
  published: { keys: { kid: string; status: string }[]; env_value: string }
  keks: { keks: { kek_id: string; state: string; total: number }[]; pending: number }
}

/**
 * adr/0061 §3.2, §4.5, Ek C8: the keys are the owner's; every change asks
 * the step-up and is recorded; the signing key rotates in three steps with
 * the old key verifying through the overlap; no private key or secret
 * value is in an answer, a row, an audit entry or a workflow's record.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member
    let others: Member[]

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      others = [
        await makeMember(http, getContainer(), "operator"),
        await makeMember(http, getContainer(), "finance"),
        await makeMember(http, getContainer(), "readonly"),
      ]
    })

    const vault = () => getContainer().resolve<VaultModuleService>(VAULT_MODULE)
    const overview = async () => (await call.get(K, owner)).data as unknown as Overview
    const change = async (path: string) => call.post(path, {}, owner, await proved(http, owner))

    it("refuses every other role, reads and changes alike", async () => {
      for (const member of others) {
        expect((await call.get(K, member)).status).toBe(403)
        for (const path of CHANGES) {
          expect((await call.post(path, {}, member, await proved(http, member))).status).toBe(403)
        }
      }
    })

    it("asks the owner's step-up for every change, the refusal recorded", async () => {
      expect((await call.get(K, owner)).status).toBe(200)
      for (const path of CHANGES) {
        const answer = await call.post(path, {}, owner)

        expect(answer.status).toBe(428)
        expect(answer.data).toMatchObject({ message: "cp.step_up_required" })
      }
      const rows = await auditRows(getContainer(), { outcome: 428, actor_id: owner.userId })
      expect(rows.map((row) => row.action).sort()).toEqual(CHANGES.map((p) => `POST ${p}`).sort())
    })

    it("rotates the signing key in three steps, the old key verifying through the overlap", async () => {
      const first = await change(`${K}/signing/prepare`)
      expect(first.status).toBe(200)
      const a = (first.data as unknown as { signing_key: { kid: string; status: string } })
        .signing_key
      expect(a.status).toBe("active")
      const document = { tenant_id: "ten_1", serial: 1 }
      const signedByA = await signPlanDocument(getContainer(), document)
      expect(signedByA.kid).toBe(a.kid)

      const second = await change(`${K}/signing/prepare`)
      const b = (second.data as unknown as { signing_key: { kid: string; status: string } })
        .signing_key
      expect(b.status).toBe("next")
      // Prepared, not signing yet; a second `next` is refused
      expect((await signPlanDocument(getContainer(), document)).kid).toBe(a.kid)
      expect((await change(`${K}/signing/prepare`)).data).toMatchObject({
        message: "cp.signing_next_exists",
      })
      expect((await overview()).published.keys.map((key) => key.kid)).toEqual([a.kid, b.kid])

      const switched = await change(`${K}/signing/switch`)
      expect(switched.data).toEqual({ active: b.kid, previous: a.kid })
      const signedByB = await signPlanDocument(getContainer(), { ...document, serial: 2 })
      expect(signedByB.kid).toBe(b.kid)
      // The shops' list during the overlap: both verify
      const published = await overview()
      const keys = parsePublicKeys(published.published.env_value, "CONTROL_PLANE_PUBLIC_KEYS")
      expect(verifyDocument("plan", document, signedByA, (kid) => keys.get(kid))).toEqual({
        ok: true,
        kid: a.kid,
      })
      expect(
        verifyDocument("plan", { ...document, serial: 2 }, signedByB, (kid) => keys.get(kid))
      ).toEqual({ ok: true, kid: b.kid })
      expect((await change(`${K}/signing/switch`)).data).toMatchObject({
        message: "cp.signing_no_next",
      })

      const retired = await change(`${K}/signing/retire`)
      expect(retired.data).toEqual({ retired: a.kid })
      const after = await overview()
      expect(after.published.keys.map((key) => key.kid)).toEqual([b.kid])
      expect(after.signing_keys.map((key) => [key.kid, key.status])).toEqual([
        [a.kid, "retired"],
        [b.kid, "active"],
      ])
      // The retired key's private half is gone; the new one still signs
      expect(await vault().listSecretMeta("platform")).toEqual([
        expect.objectContaining({ name: `cp_signing_key.${b.kid}` }),
      ])
      expect((await change(`${K}/signing/retire`)).data).toMatchObject({
        message: "cp.signing_no_previous",
      })
      const audit = await auditRows(getContainer(), {
        action: `POST ${K}/signing/switch`,
        outcome: 200,
      })
      expect(audit[0]?.changes).toMatchObject({ active: { from: a.kid, to: b.kid } })
    })

    it("keeps the private key out of answers, rows, audit entries and workflow records", async () => {
      const made = await change(`${K}/signing/prepare`)
      const { kid } = (made.data as unknown as { signing_key: { kid: string } }).signing_key
      const seed = (await vault().openSecret("platform", `cp_signing_key.${kid}`)).toString("utf8")
      const read = await call.get(K, owner)

      expect(seed).toMatch(/^[A-Za-z0-9_-]{43}$/)
      for (const form of formsOf(seed)) {
        expect(JSON.stringify(made.data)).not.toContain(form)
        expect(JSON.stringify(read.data)).not.toContain(form)
      }
      expect(read.headers["cache-control"]).toBe("no-store")
      expect(await tablesHolding(getContainer(), formsOf(seed))).toEqual([])
      const executions = await getContainer()
        .resolve(Modules.WORKFLOW_ENGINE)
        .listWorkflowExecutions({
          workflow_id: ["cp-signing-key-prepare", "cp-signing-key-switch", "cp-sealed-rewrap"],
        })
      expect(executions).toHaveLength(0)
      const [row] = await vault().listSecretRecords({ name: `cp_signing_key.${kid}` })
      expect(row?.sealed).toMatch(/^qtenv1\./)
    })
  },
})
