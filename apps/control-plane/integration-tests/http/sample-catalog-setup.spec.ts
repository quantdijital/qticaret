import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { sectorPacks } from "@qticaret/sector-packs"
import { fakeState } from "../../src/lib/provisioning/fake-provisioner"
import { fakeSamples } from "../../src/lib/provisioning/fake-samples"
import { PROVISIONING_MODULE } from "../../src/modules/provisioning"
import type ProvisioningModuleService from "../../src/modules/provisioning/service"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { ensureSigningKey, packageFor } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, freshSlug, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

// Whatever packs this release ships with and without samples: no pack named here
const WITH = sectorPacks().find((pack) => (pack.samples?.products.length ?? 0) > 0)
const WITHOUT = sectorPacks().find((pack) => !pack.samples)
if (!WITH || !WITHOUT) {
  throw new Error("@qticaret/sector-packs needs a pack with samples and one without")
}
const PRODUCTS = WITH.samples?.products.length ?? 0

interface Run {
  id: string
  status: string
  error_code: string | null
  steps?: {
    name: string
    status: string
    created: boolean
    error_code: string | null
    output: Record<string, unknown> | null
  }[]
}

const stepOf = (run: Run) => run.steps?.find((step) => step.name === "sample_catalog")

/**
 * The wizard's "Örnek ürünlerle başla": offered only for a pack with
 * samples, off unless asked for, loaded by the setup's `sample_catalog`
 * step after the look, once; a load that fails is a warning on a setup
 * that still finishes; a failed setup forgets it, and its retry loads it.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    const container = (): MedusaContainer => getContainer()
    const runs = () => container().resolve<ProvisioningModuleService>(PROVISIONING_MODULE)
    const tenants = () => container().resolve<TenantsModuleService>(TENANTS_MODULE)
    let operator: Member

    beforeAll(async () => {
      operator = await makeMember(http, container(), "operator")
    })

    beforeEach(async () => {
      await ensureSigningKey(container())
      fakeState().failOn = null
    })

    async function create(tenantId: string): Promise<Run> {
      const answer = await call.post(
        `/admin/cp/tenants/${tenantId}/provisioning`,
        {},
        operator,
        await proved(http, operator)
      )
      expect(answer.status).toBe(202)
      const id = (answer.data as { run: Run }).run.id
      for (let i = 0; i < 200; i++) {
        if ((await runs().runOf(tenantId, id)).status !== "running") {
          const read = await call.get(
            `/admin/cp/tenants/${tenantId}/provisioning/runs/${id}`,
            operator
          )
          return (read.data as { run: Run }).run
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("run did not finish")
    }

    async function shop(body: Record<string, unknown>) {
      const packageId = await packageFor(container(), `paket-${String(Date.now())}`)
      const made = await makeTenant(http, operator, { package_id: packageId, ...body })
      await tenants().saveContact(made.id, null, {
        name: "Ayşe Yılmaz",
        role: "owner",
        email: `sahip-${String(Date.now())}@example.com`,
        phone: "+905321234567",
      })
      return made
    }

    it("offers samples only for a pack that has them, off unless asked for", async () => {
      const listed = await call.get("/admin/cp/sector-packs", operator)
      const packs = (listed.data as { sector_packs: { code: string; sample_products: number }[] })
        .sector_packs
      expect(packs.find((pack) => pack.code === WITH.code)?.sample_products).toBe(PRODUCTS)
      expect(packs.find((pack) => pack.code === WITHOUT.code)?.sample_products).toBe(0)

      const plain = await makeTenant(http, operator, { sector_pack: WITH.code })
      expect((await tenants().tenantOf(plain.id)).sample_catalog).toBe(false)
      for (const body of [{ sector_pack: WITHOUT.code }, {}]) {
        const refused = await call.post(
          "/admin/cp/tenants",
          { name: "Kalem", slug: freshSlug(), sample_catalog: true, ...body },
          operator,
          await proved(http, operator)
        )
        expect(refused.status).toBe(400)
        expect(JSON.stringify(refused.data)).toContain("cp.sample_catalog_unavailable")
      }
      const run = await create((await shop({ sector_pack: WITH.code })).id)
      expect(stepOf(run)).toMatchObject({ status: "skipped", output: { requested: false } })
    })

    it("loads the samples after the look, once; an active shop gets none from a run again", async () => {
      const made = await shop({ sector_pack: WITH.code, sample_catalog: true })
      const first = await create(made.id)
      expect(first.status).toBe("succeeded")
      const names = (first.steps ?? []).map((step) => step.name)
      expect(names.indexOf("sample_catalog")).toBe(names.indexOf("preset") + 1)
      expect(stepOf(first)).toMatchObject({
        status: "succeeded",
        created: true,
        error_code: null,
        output: { pack: WITH.code, products: PRODUCTS },
      })
      const tenant = await tenants().tenantOf(made.id)
      expect(tenant.sample_catalog_loaded_at).not.toBeNull()
      expect([...(fakeSamples().get(made.id) ?? [])]).toEqual([WITH.code])

      // Review L1, as the look: never into an active shop from a setup run
      await tenants().updateTenants({ id: made.id, sample_catalog_loaded_at: null })
      const again = await create(made.id)
      expect(stepOf(again)).toMatchObject({ status: "skipped", output: { active: true } })
    })

    it("keeps a failed load as a warning: the shop is still set up", async () => {
      const made = await shop({ sector_pack: WITH.code, sample_catalog: true })
      fakeState().failOn = "runTenantCommand:load-samples"
      const run = await create(made.id)
      expect(run.status).toBe("succeeded")
      expect(stepOf(run)).toMatchObject({
        status: "skipped",
        error_code: "provisioning.fake_failure",
      })
      const tenant = await tenants().tenantOf(made.id)
      expect(tenant.status).toBe("active")
      expect(tenant.sample_catalog_loaded_at).toBeNull()
      expect(fakeSamples().get(made.id)).toBeUndefined()
    })

    it("forgets the load with a failed run, and the retry counts it loaded", async () => {
      const made = await shop({ sector_pack: WITH.code, sample_catalog: true })
      fakeState().failOn = "start"
      const failed = await create(made.id)
      expect(failed.status).toBe("failed")
      expect(stepOf(failed)?.status).toBe("compensated")
      expect((await tenants().tenantOf(made.id)).sample_catalog_loaded_at).toBeNull()

      const retried = await create(made.id)
      expect(retried.status).toBe("succeeded")
      expect(stepOf(retried)?.error_code).toBeNull()
      expect((await tenants().tenantOf(made.id)).sample_catalog_loaded_at).not.toBeNull()
    })
  },
})
