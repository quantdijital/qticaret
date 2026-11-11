import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { parsePublicKeys } from "@qticaret/server-kit"
import { signedPlanDocumentSchema } from "@qticaret/types/control-plane"
import { publishedKeys } from "../../src/lib/vault/signing"
import { reissuePlanDocuments } from "../../src/lib/fleet/reissue"
import { PLANS_MODULE } from "../../src/modules/plans"
import type PlansModuleService from "../../src/modules/plans/service"
import {
  ensureSigningKey,
  fleetOf,
  packageFor,
  shopKey,
  shopReceiver,
  signedGet,
} from "../helpers/fleet"
import { anyStatus, makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { freshSlug, makeTenant } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const PLAN = "/tenant-api/v1/plan"

/**
 * adr/0061 §3.2, §3.4, Ek C9: the shops' signed API. A shop pulls its own
 * latest plan document with an Ed25519 request: a bad signature, a time
 * outside ±5 minutes, a reused nonce, an unknown or retired key and
 * another shop's id are refused alike; no staff credential opens it. The
 * document it gets passes the shop backend's own receiver checks.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      await ensureSigningKey(getContainer())
    })

    const get = (headers: Record<string, string>, path = PLAN) =>
      http.get<{ message?: string }>(path, { ...anyStatus, headers })

    /** A shop on a package, with a key and an issued document. */
    async function shopWithDocument() {
      const tenant = await makeTenant(http, owner)
      const packageId = await packageFor(getContainer(), freshSlug("paket"))
      await getContainer()
        .resolve<PlansModuleService>(PLANS_MODULE)
        .assignPlan(tenant.id, packageId, null)
      await reissuePlanDocuments(getContainer(), [tenant.id], { push: false })
      return { tenant, signer: await shopKey(getContainer(), tenant.id) }
    }

    it("hands a shop its latest document, which the shop's own checks accept", async () => {
      const { tenant, signer } = await shopWithDocument()
      const answer = await get(signedGet(PLAN, tenant.id, signer))

      expect(answer.status).toBe(200)
      expect(answer.headers["cache-control"]).toBe("no-store")
      const signed = signedPlanDocumentSchema.parse(answer.data)
      expect(signed.document).toMatchObject({ tenant_id: tenant.id, serial: 1 })

      // One process, both ends: the backend's receiver with the published keys
      const published = await publishedKeys(getContainer())
      const keys = parsePublicKeys(published.env_value, "CONTROL_PLANE_PUBLIC_KEYS")
      const { checkPlanDocument } = shopReceiver()
      expect(checkPlanDocument(answer.data, { publicKeys: keys, tenantId: tenant.id })).toEqual({
        ok: true,
        signed,
      })
      expect(checkPlanDocument(answer.data, { publicKeys: keys, tenantId: "ten_other" })).toEqual({
        ok: false,
        code: "control_plane.wrong_tenant",
      })
      expect((await fleetOf(getContainer()).planDocumentSummary(tenant.id))?.pulled_at).not.toBe(
        null
      )
    })

    it("refuses a bad signature, a stale time and a reused nonce", async () => {
      const { tenant, signer } = await shopWithDocument()
      const good = signedGet(PLAN, tenant.id, signer)
      const tampered = {
        ...good,
        "x-qt-signature": `${(good["x-qt-signature"] ?? "").slice(0, -2)}AA`,
      }
      const old = signedGet(PLAN, tenant.id, signer, { now: Date.now() - 6 * 60 * 1000 })
      const ahead = signedGet(PLAN, tenant.id, signer, { now: Date.now() + 6 * 60 * 1000 })

      expect((await get(tampered)).data.message).toBe("signature.invalid")
      expect((await get(old)).data.message).toBe("signature.stale")
      expect((await get(ahead)).data.message).toBe("signature.stale")
      expect((await get(good)).status).toBe(200)
      const replay = await get(good)
      expect([replay.status, replay.data.message]).toEqual([401, "signature.replayed"])
      // The signature covers the path and its query: the same headers on another target fail
      const moved = await get(signedGet(PLAN, tenant.id, signer), `${PLAN}?x=1`)
      expect([moved.status, moved.data.message]).toEqual([401, "signature.invalid"])
    })

    it("refuses an unknown key, a retired key and another shop's id alike", async () => {
      const a = await shopWithDocument()
      const b = await shopWithDocument()
      const fleet = fleetOf(getContainer())

      // B's key, A's id: no key of A's by that kid
      const crossed = await get(signedGet(PLAN, a.tenant.id, b.signer))
      expect([crossed.status, crossed.data.message]).toEqual([401, "signature.invalid"])
      const nobody = await get(signedGet(PLAN, "ten_01NOBODY", a.signer))
      expect([nobody.status, nobody.data.message]).toEqual([401, "signature.invalid"])

      // A rotates: its next key works at once, the old one stops once retired
      const next = await shopKey(getContainer(), a.tenant.id)
      expect((await get(signedGet(PLAN, a.tenant.id, next))).status).toBe(200)
      await fleet.promoteTenantKey(a.tenant.id)
      const retired = await get(signedGet(PLAN, a.tenant.id, a.signer))
      expect([retired.status, retired.data.message]).toEqual([401, "signature.invalid"])
      expect((await get(signedGet(PLAN, a.tenant.id, next))).status).toBe(200)
    })

    it("answers only listed routes, takes no body and no staff credential", async () => {
      const { tenant, signer } = await shopWithDocument()

      expect((await get({})).data.message).toBe("signature.malformed")
      expect((await get(owner.headers)).status).toBe(401)
      expect(
        (await get(signedGet("/tenant-api/v1/usage", tenant.id, signer), "/tenant-api/v1/usage"))
          .status
      ).toBe(404)
      expect((await get({}, "/tenant-api/v2/plan")).status).toBe(404)
      const withBody = await http.get(PLAN, {
        ...anyStatus,
        headers: { ...signedGet(PLAN, tenant.id, signer), "content-type": "application/json" },
        data: "{}",
      })
      expect(withBody.status).toBe(400)
      // The staff side never reaches it either
      expect(
        (await http.get("/admin/cp/tenant-api/v1/plan", { ...anyStatus, headers: owner.headers }))
          .status
      ).toBe(404)
    })

    it("says there is no document yet, to the shop that signed only", async () => {
      const tenant = await makeTenant(http, owner)
      const signer = await shopKey(getContainer(), tenant.id)
      const answer = await get(signedGet(PLAN, tenant.id, signer))

      expect([answer.status, answer.data.message]).toEqual([404, "plan.none"])
    })
  },
})
