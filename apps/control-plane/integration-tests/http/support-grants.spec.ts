import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { parsePublicKeys, verifyDocument } from "@qticaret/server-kit"
import { SUPPORT_GRANT_PURPOSE, signedSupportGrantSchema } from "@qticaret/types/control-plane"
import { publishedKeys } from "../../src/lib/vault/signing"
import { PROVISIONING_MODULE } from "../../src/modules/provisioning"
import type ProvisioningModuleService from "../../src/modules/provisioning/service"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { ensureSigningKey } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const REASON = "Ürün girişi ve vitrin düzeni için kurulum desteği"
const PORT = 9277

/**
 * adr/0061 Ek "Destek erişimi" (2026-11-28), Karar 7: owner and operator
 * get a signed, single-use grant into a shop's panel, behind a step-up
 * every time, with a reason; the reason stays as a note, the audit keeps
 * the grant's id and never the grant.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member
    let operator: Member
    let finance: Member
    let readonly: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      operator = await makeMember(http, getContainer(), "operator")
      finance = await makeMember(http, getContainer(), "finance")
      readonly = await makeMember(http, getContainer(), "readonly")
      await ensureSigningKey(getContainer())
    })

    const tenants = () => getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)

    /** A shop set up on this machine (the fake provisioner's port), in `status`. */
    async function shop(status: "active" | "suspended" | "provisioning" = "active") {
      const tenant = await makeTenant(http, operator)
      const now = new Date()
      await getContainer()
        .resolve<ProvisioningModuleService>(PROVISIONING_MODULE)
        .createProvisioningRuns([
          {
            tenant_id: tenant.id,
            kind: "create",
            status: "succeeded",
            provider: "fake",
            port: PORT,
            started_at: now,
            finished_at: now,
            heartbeat_at: now,
          },
        ])
      if (status !== "provisioning") {
        await tenants().changeStatus(tenant.id, "active", {
          reason_code: "provisioned",
          actor: "system",
        })
      }
      if (status === "suspended") {
        await tenants().changeStatus(tenant.id, "suspended", {
          reason_code: "staff_suspend",
          actor: "system",
        })
      }
      return tenant.id
    }

    const grant = async (
      id: string,
      member: Member,
      body: unknown = { reason: REASON, minutes: 30 }
    ) =>
      call.post(`/admin/cp/tenants/${id}/support-grants`, body, member, await proved(http, member))

    it("issues a grant the shop can verify: its panel's link, bound to the shop and the member", async () => {
      const id = await shop()
      const before = Date.now()

      const answer = await grant(id, operator)

      expect(answer.status).toBe(200)
      expect(answer.headers["cache-control"]).toBe("no-store")
      const { url, grant_id, expires_at } = answer.data as {
        url: string
        grant_id: string
        expires_at: string
      }
      expect(url.startsWith(`http://localhost:${String(PORT + 1000)}/support#grant=`)).toBe(true)
      const encoded = new URLSearchParams(new URL(url).hash.slice(1)).get("grant") ?? ""
      const signed = signedSupportGrantSchema.parse(
        JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
      )
      expect(signed.document).toMatchObject({
        tenant_id: id,
        grant_id,
        audience: "shop_panel",
        reason: REASON,
        operator: { id: operator.userId, role: "operator" },
      })
      const lasts = signed.document.expires_at - signed.document.issued_at
      expect(lasts).toBe(30 * 60)
      expect(new Date(expires_at).getTime()).toBeGreaterThanOrEqual(before + 29 * 60_000)
      const keys = parsePublicKeys((await publishedKeys(getContainer())).env_value, "keys")
      expect(
        verifyDocument(SUPPORT_GRANT_PURPOSE, signed.document, signed, (kid) => keys.get(kid)).ok
      ).toBe(true)

      // The reason as a note on the shop; the audit with the id and never the grant
      const notes = await tenants().listTenantNotes({ tenant_id: id }, { take: 10 })
      expect(notes.map((note) => note.body)).toEqual([`Destek erişimi (30 dk): ${REASON}`])
      const audit = await auditRows(getContainer(), {
        action: "POST /admin/cp/tenants/:id/support-grants",
        resource_id: id,
      })
      expect(audit).toHaveLength(1)
      expect(audit[0]).toMatchObject({
        outcome: 200,
        changes: { support_grant: { id: grant_id, minutes: 30, reason_length: REASON.length } },
      })
      expect(JSON.stringify(audit[0])).not.toContain(signed.signature)
      expect(JSON.stringify(audit[0])).not.toContain(REASON)
    })

    it("gives a new grant each time, owner too, and into a suspended shop", async () => {
      const id = await shop("suspended")
      const first = await grant(id, owner, { reason: REASON, minutes: 60 })
      const second = await grant(id, operator, { reason: REASON, minutes: 15 })

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect((first.data as { grant_id: string }).grant_id).not.toBe(
        (second.data as { grant_id: string }).grant_id
      )
    })

    it("takes a step-up proof for one grant only (security review L1)", async () => {
      const id = await shop()
      const proof = await proved(http, operator)
      const path = `/admin/cp/tenants/${id}/support-grants`
      const body = { reason: REASON, minutes: 30 }
      const first = await call.post(path, body, operator, proof)
      const again = await call.post(path, body, operator, proof)

      expect(first.status).toBe(200)
      expect(again.status).toBe(428)
      expect(again.data).toMatchObject({ message: "cp.step_up_invalid" })
    })

    it("refuses a shop still being set up: 409 cp.support_unavailable", async () => {
      const id = await shop("provisioning")
      const answer = await grant(id, operator)
      expect(answer.status).toBe(409)
      expect(answer.data).toMatchObject({ message: "cp.support_unavailable" })
    })

    it("asks for a step-up every time, a reason, an offered length and a role that runs shops", async () => {
      const id = await shop()
      const plain = await call.post(
        `/admin/cp/tenants/${id}/support-grants`,
        { reason: REASON, minutes: 30 },
        operator
      )
      const short = await grant(id, operator, { reason: "kısa", minutes: 30 })
      const twoLines = await grant(id, operator, { reason: `${REASON}\nikinci`, minutes: 30 })
      const longer = await grant(id, operator, { reason: REASON, minutes: 120 })
      const extra = await grant(id, operator, { reason: REASON, minutes: 30, role: "owner" })
      const byFinance = await grant(id, finance)
      const byReader = await grant(id, readonly)

      expect(plain.status).toBe(428)
      for (const answer of [short, twoLines, longer, extra]) {
        expect(answer.status).toBe(400)
      }
      expect(byFinance.status).toBe(403)
      expect(byReader.status).toBe(403)
      expect(await tenants().listTenantNotes({ tenant_id: id }, { take: 10 })).toHaveLength(0)
    })
  },
})
