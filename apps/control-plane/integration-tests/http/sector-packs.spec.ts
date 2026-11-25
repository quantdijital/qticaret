import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { sectorPack, summaryOf } from "@qticaret/sector-packs"
import { fakeState } from "../../src/lib/provisioning/fake-provisioner"
import { PROVISIONING_MODULE } from "../../src/modules/provisioning"
import type ProvisioningModuleService from "../../src/modules/provisioning/service"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { ensureSigningKey, packageFor } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, freshSlug, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

// The cutlery pack as this release ships it. Its version and counts move with
// its data (each new ready-made look raises both), so they are read from the
// package, not written down here: the tests check that the control plane
// passes on what the pack holds
const cutleryPack = sectorPack("cutlery")
if (!cutleryPack) {
  throw new Error("the cutlery pack is missing from @qticaret/sector-packs")
}
const CUTLERY = summaryOf(cutleryPack)
// A first apply adds every item but the looks: those are offered in the
// shop's theme editor, not written by the pack (adr/0063)
const CUTLERY_ITEMS = Object.entries(CUTLERY.counts)
  .filter(([kind]) => kind !== "presets")
  .reduce((sum, [, n]) => sum + n, 0)

interface Run {
  id: string
  kind: string
  status: string
  error_code: string | null
  steps?: {
    name: string
    status: string
    created: boolean
    output: Record<string, unknown> | null
  }[]
}

interface Pack {
  code: string
  version: number
  name: string
  description: string
  counts: Record<string, number>
}

/**
 * adr/0061 C12: the sector packs the wizard offers, a new shop on any of
 * them, and "Paketi yeniden uygula": an `apply_pack` run of the setup's
 * step, owner and operator only, behind a fresh proof, idempotent.
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

    beforeAll(async () => {
      owner = await makeMember(http, container(), "owner")
      operator = await makeMember(http, container(), "operator")
      finance = await makeMember(http, container(), "finance")
      readonly = await makeMember(http, container(), "readonly")
    })

    beforeEach(async () => {
      await ensureSigningKey(container())
      fakeState().failOn = null
    })

    const base = (id: string) => `/admin/cp/tenants/${id}/provisioning`

    async function run(tenantId: string, action: string, member: Member = operator) {
      const answer = await call.post(
        `${base(tenantId)}${action}`,
        {},
        member,
        await proved(http, member)
      )
      expect(answer.status).toBe(202)
      const id = (answer.data as { run: Run }).run.id
      for (let i = 0; i < 200; i++) {
        if ((await runs().runOf(tenantId, id)).status !== "running") {
          return ((await call.get(`${base(tenantId)}/runs/${id}`, operator)).data as { run: Run })
            .run
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("run did not finish")
    }

    /** A shop on a package and a pack, set up: its id. */
    async function setUp(pack: string) {
      const packageId = await packageFor(container(), `paket-${String(Date.now())}`)
      const tenant = await makeTenant(http, operator, { package_id: packageId, sector_pack: pack })
      await tenants().saveContact(tenant.id, null, {
        name: "Ayşe Yılmaz",
        role: "owner",
        email: `sahip-${String(Date.now())}@example.com`,
        phone: null,
      })
      const created = await run(tenant.id, "")
      expect(created.status).toBe("succeeded")
      return { id: tenant.id, created }
    }

    it("lists every pack for every role: manifest and counts, the general one first", async () => {
      for (const member of [owner, operator, finance, readonly]) {
        const answer = await call.get("/admin/cp/sector-packs", member)
        expect(answer.status).toBe(200)
        const packs = (answer.data as { sector_packs: Pack[] }).sector_packs
        expect(packs[0]?.code).toBe("general")
        const cutlery = packs.find((pack) => pack.code === "cutlery")
        expect(cutlery?.description).toContain("namlu çeliği")
        expect(cutlery?.name).toBe("Bıçak ve çatal-bıçak")
        expect(cutlery).toEqual(CUTLERY)
        for (const n of Object.values(cutlery?.counts ?? {})) {
          expect(n).toBeGreaterThan(0)
        }
      }
      expect((await call.get("/admin/cp/sector-packs?code=general", owner)).status).toBe(400)
    })

    it("makes a shop on any known pack and refuses an unknown one", async () => {
      const made = await makeTenant(http, operator, { sector_pack: "cutlery" })
      expect((await tenants().tenantOf(made.id)).sector_pack).toBe("cutlery")
      for (const pack of ["knives", "../general", "GENERAL"]) {
        const refused = await call.post(
          "/admin/cp/tenants",
          { name: "Kalem", slug: freshSlug(), sector_pack: pack },
          operator,
          await proved(http, operator)
        )
        expect(refused.status).toBe(400)
      }
    })

    it("applies the shop's pack in its setup, then again on request, adding nothing", async () => {
      const { id, created } = await setUp("cutlery")
      const step = created.steps?.find((each) => each.name === "sector_pack")
      expect(step).toMatchObject({ status: "succeeded", created: false })
      expect(step?.output).toMatchObject({
        pack: "cutlery",
        version: CUTLERY.version,
        added: CUTLERY_ITEMS,
        kept: 0,
      })
      const detail = await call.get(`/admin/cp/tenants/${id}`, readonly)
      expect(detail.data).toMatchObject({
        tenant: { sector_pack: "cutlery", sector_pack_version: CUTLERY.version },
      })
      expect(
        (detail.data as { tenant: { sector_pack_applied_at: string | null } }).tenant
          .sector_pack_applied_at
      ).not.toBeNull()

      // Who may: the owner and the operator, each with a fresh proof
      expect((await call.post(`${base(id)}/apply-pack`, {}, finance)).status).toBe(403)
      expect((await call.post(`${base(id)}/apply-pack`, {}, readonly)).status).toBe(403)
      expect((await call.post(`${base(id)}/apply-pack`, {}, operator)).status).toBe(428)
      const again = await run(id, "/apply-pack", owner)
      expect(again).toMatchObject({ kind: "apply_pack", status: "succeeded", error_code: null })
      expect(again.steps?.map((each) => [each.name, each.status])).toEqual([
        ["sector_pack", "skipped"],
      ])
      expect(again.steps?.[0]?.output).toMatchObject({ pack: "cutlery", added: 0 })
      expect(fakeState().shops.get(id)?.packs).toEqual({ cutlery: CUTLERY.version })
      const rows = await auditRows(container(), { resource_id: id })
      expect(rows.map((row) => (row as { action: string }).action)).toContain(
        "POST /admin/cp/tenants/:id/provisioning/apply-pack"
      )
    })

    it("refuses a pack the release does not have, and a shop neither set up nor active", async () => {
      const { id } = await setUp("general")
      await tenants().updateTenants({ id, sector_pack: "eski-paket" })
      const failed = await run(id, "/apply-pack")
      expect(failed).toMatchObject({
        status: "failed",
        error_code: "provisioning.sector_pack_unknown",
      })

      await tenants().updateTenants({ id, sector_pack: "general" })
      await tenants().changeStatus(id, "suspended", { reason_code: "test", actor: "system" })
      const refused = await call.post(
        `${base(id)}/apply-pack`,
        {},
        operator,
        await proved(http, operator)
      )
      expect(refused.status).toBe(409)
      expect(refused.data).toMatchObject({ message: "provisioning.tenant_status" })
    })
  },
})
