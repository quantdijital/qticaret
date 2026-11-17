import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { parsePublicKeys, verifyDocument } from "@qticaret/server-kit"
import { pushPlanDocument } from "../../src/lib/fleet/push"
import { parseTenantApiHosts } from "../../src/lib/fleet/push-target"
import { publishedKeys } from "../../src/lib/vault/signing"
import { issuePlanDocumentWorkflow } from "../../src/workflows/fleet/plan-document"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { ensureSigningKey, fleetOf } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, freshSlug, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const FLAG = "test.platform_sample"
// adr/0069: the first business flag, on by default
const VIDEOS = "catalog.product_videos"
const AI_OWN_KEYS = "ai.own_keys"

interface Detail {
  features: { key: string; value: boolean; package?: boolean; override?: boolean }[]
  platform_flags: { key: string; default: boolean }[]
  plan_document?: { issued: boolean; serial?: number; push_status?: string }
}

/**
 * adr/0061 §3.2, Ek C9: a shop's plan document is issued with a growing
 * serial when what it says changes (its package, the package's limits and
 * flags, its exceptions), never when nothing did, signed with the active
 * key; flag exceptions follow the limit exceptions' rules; the push is
 * best effort and its outcome kept for the shop page.
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

    const latest = (tenantId: string) => fleetOf(getContainer()).latestPlanDocument(tenantId)

    async function shopOnPackage(features: Record<string, boolean> = {}) {
      const made = await call.post(
        "/admin/cp/plans",
        { code: freshSlug("paket"), name: "Paket", price: 49_000, period: "monthly", features },
        finance,
        await proved(http, finance)
      )
      const packageId = (made.data as { plan: { id: string } }).plan.id
      const tenant = await makeTenant(http, operator, { package_id: packageId })
      return { tenant, packageId }
    }

    it("issues a signed document with the package, then again only when it changes", async () => {
      const { tenant, packageId } = await shopOnPackage({ [FLAG]: false })
      const first = await latest(tenant.id)
      expect(first).toMatchObject({ serial: 1, push_status: "pending" })
      expect(first?.document).toMatchObject({
        tenant_id: tenant.id,
        status: "provisioning",
        limits: { products: null, custom_domains: null },
        platform_flags: { [FLAG]: false },
        billing: { status: "active", due_on: null, amount: null, currency: "TRY" },
      })
      const keys = parsePublicKeys((await publishedKeys(getContainer())).env_value, "keys")
      expect(
        verifyDocument("plan", first?.document, first ?? { kid: "", signature: "" }, (kid) =>
          keys.get(kid)
        )
      ).toMatchObject({ ok: true })

      // The same package again and a price: nothing a document says changed
      await call.post(
        `/admin/cp/tenants/${tenant.id}/plan`,
        { package_id: packageId },
        operator,
        await proved(http, operator)
      )
      await call.post(
        `/admin/cp/plans/${packageId}/price`,
        { price: 59_000, period: "monthly" },
        finance,
        await proved(http, finance)
      )
      expect((await latest(tenant.id))?.serial).toBe(1)

      // A limit exception, then the package's own limit: each a new serial
      await call.post(
        `/admin/cp/tenants/${tenant.id}/overrides`,
        { key: "products", value: 50, reason: "Kampanya dönemi" },
        operator
      )
      expect((await latest(tenant.id))?.document.limits.products).toBe(50)
      await call.post(`/admin/cp/plans/${packageId}`, { limits: { staff: 4 } }, finance)
      const third = await latest(tenant.id)
      expect([third?.serial, third?.document.limits.staff]).toEqual([3, 4])
      // The older pending push is superseded by the newer document
      const rows = await fleetOf(getContainer()).listPlanDocuments(
        { tenant_id: tenant.id },
        { order: { serial: "ASC" } }
      )
      expect(rows.map((row) => row.push_status).slice(0, 2)).not.toContain("pending")
    })

    it("sets and removes a shop's flag exception, owner and operator only, with a reason", async () => {
      const { tenant } = await shopOnPackage({ [FLAG]: false })
      const path = `/admin/cp/tenants/${tenant.id}/feature-overrides`
      const body = { key: FLAG, enabled: true, reason: "Deneme için açıldı" }

      expect((await call.post(path, body, readonly)).status).toBe(403)
      expect((await call.post(path, body, finance)).status).toBe(403)
      expect((await call.post(path, { ...body, reason: "" }, operator)).status).toBe(400)
      expect((await call.post(path, { ...body, key: "catalog.addons" }, operator)).status).toBe(400)
      expect((await call.post(path, { ...body, extra: 1 }, operator)).status).toBe(400)
      expect((await call.post(path, body, operator)).status).toBe(200)
      expect((await latest(tenant.id))?.document.platform_flags[FLAG]).toBe(true)

      const detail = (await call.get(`/admin/cp/tenants/${tenant.id}`, owner))
        .data as unknown as Detail
      // adr/0069: the product videos flag is listed first, at its default
      expect(detail.features).toEqual([
        expect.objectContaining({ key: VIDEOS, value: true }),
        expect.objectContaining({ key: AI_OWN_KEYS, value: true }),
        expect.objectContaining({ key: FLAG, package: false, override: true, value: true }),
      ])
      expect(detail.platform_flags).toEqual([
        { key: VIDEOS, default: true },
        { key: AI_OWN_KEYS, default: true },
        { key: FLAG, default: true },
      ])

      expect((await call.delete(`${path}/${FLAG}`, operator)).status).toBe(200)
      expect((await call.delete(`${path}/${FLAG}`, operator)).status).toBe(404)
      expect((await call.delete(`${path}/catalog.addons`, owner)).status).toBe(404)
      expect((await latest(tenant.id))?.document.platform_flags[FLAG]).toBe(false)
    })

    it("refuses a package flag the shared list does not have", async () => {
      const answer = await call.post(
        "/admin/cp/plans",
        {
          code: freshSlug("paket"),
          name: "Paket",
          price: 1,
          period: "monthly",
          features: { "catalog.addons": true },
        },
        finance,
        await proved(http, finance)
      )
      expect(answer.status).toBe(400)
    })

    it("shows the document's state to who runs shops only", async () => {
      const { tenant } = await shopOnPackage()
      const read = async (member: Member) =>
        ((await call.get(`/admin/cp/tenants/${tenant.id}`, member)).data as unknown as Detail)
          .plan_document

      expect(await read(operator)).toMatchObject({ issued: true, serial: 1 })
      expect(await read(owner)).toMatchObject({ issued: true })
      expect(await read(finance)).toBeUndefined()
      expect(await read(readonly)).toBeUndefined()
    })

    it("pushes to an allowed target, retries what may pass later and gives up on a refusal", async () => {
      const { tenant } = await shopOnPackage()
      const tenants = getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)
      const received: unknown[] = []
      let status = 200
      const server = createServer((req, res) => {
        let body = ""
        req.on("data", (chunk: Buffer) => (body += chunk.toString()))
        req.on("end", () => {
          received.push({ path: req.url, body: JSON.parse(body) as unknown })
          res.writeHead(status).end("{}")
        })
      })
      await new Promise<void>((resolve) => server.listen(0, "localhost", resolve))
      const port = String((server.address() as AddressInfo).port)
      const base = `http://localhost:${port}`
      // The test server's own port, as an entry of CP_TENANT_API_HOSTS would allow it
      const options = { policy: { local: false, hosts: parseTenantApiHosts(`localhost:${port}`) } }
      try {
        const row = async () => {
          const found = await latest(tenant.id)
          if (!found) {
            throw new Error("no document")
          }
          return found
        }
        // No target: kept pending, tried again later
        expect(await pushPlanDocument(getContainer(), await row(), options)).toMatchObject({
          delivered: false,
          error: "no_target",
        })
        // A target outside the policy is never called
        await tenants.updateTenants({ id: tenant.id, api_base_url: "http://shop.example.com" })
        expect(await pushPlanDocument(getContainer(), await row(), options)).toMatchObject({
          error: "target_not_allowed",
        })
        expect(received).toHaveLength(0)

        await tenants.updateTenants({ id: tenant.id, api_base_url: base })
        status = 503
        const later = await pushPlanDocument(getContainer(), await row(), options)
        expect(later).toMatchObject({ delivered: false, error: "http_503" })
        expect((later as { next_push_at: Date | null }).next_push_at).not.toBeNull()
        status = 200
        expect(await pushPlanDocument(getContainer(), await row(), options)).toEqual({
          delivered: true,
        })
        expect(await row()).toMatchObject({ push_status: "delivered", push_error: null })
        const pushed = received.at(-1) as { path: string; body: Record<string, unknown> }
        expect(pushed.path).toBe("/hooks/control-plane/plan")
        expect(Object.keys(pushed.body).sort()).toEqual(["document", "kid", "signature"])
        expect(pushed.body["document"]).toMatchObject({ serial: 1 })

        // A refusal by the shop is final for this document
        status = 409
        await call.post(
          `/admin/cp/tenants/${tenant.id}/overrides`,
          { key: "staff", value: 2, reason: "Ek personel" },
          operator
        )
        await new Promise((resolve) => setTimeout(resolve, 300))
        const refused = await row()
        if (refused.push_status === "pending") {
          await pushPlanDocument(getContainer(), refused, options)
        }
        expect(await row()).toMatchObject({
          serial: 2,
          push_status: "failed",
          push_error: "http_409",
        })
      } finally {
        server.close()
      }
    })

    // Last in this file: it switches the signing key
    it("issues the same content again with the new key after a key switch (Ek C19 I2)", async () => {
      const { tenant } = await shopOnPackage()
      const before = await latest(tenant.id)
      const proof = await proved(http, owner)
      await call.post("/admin/cp/keys/signing/prepare", {}, owner, proof)
      const switched = await call.post("/admin/cp/keys/signing/switch", {}, owner, proof)
      const { active } = switched.data as { active: string }

      await issuePlanDocumentWorkflow(getContainer()).run({ input: { tenant_id: tenant.id } })
      const after = await latest(tenant.id)
      await issuePlanDocumentWorkflow(getContainer()).run({ input: { tenant_id: tenant.id } })

      expect(switched.status).toBe(200)
      expect(after?.serial).toBe((before?.serial ?? 0) + 1)
      expect(after?.kid).toBe(active)
      expect(after?.kid).not.toBe(before?.kid)
      expect(after?.content_hash).toBe(before?.content_hash)
      // Once on the active key, the same content issues nothing
      expect((await latest(tenant.id))?.serial).toBe(after?.serial)
    })
  },
})
