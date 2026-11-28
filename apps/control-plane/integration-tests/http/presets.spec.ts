import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { isValidVkn } from "@qticaret/server-kit"
import { sectorPack } from "@qticaret/sector-packs"
import { fakeState } from "../../src/lib/provisioning/fake-provisioner"
import { PROVISIONING_MODULE } from "../../src/modules/provisioning"
import type ProvisioningModuleService from "../../src/modules/provisioning/service"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { ensureSigningKey, packageFor } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, freshSlug, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

// The cutlery pack's looks as this release ships them: the first is the wizard's default
const cutlery = sectorPack("cutlery")
const FIRST = cutlery?.presets[0]
if (!cutlery || !FIRST) {
  throw new Error("the cutlery pack has no ready-made look in @qticaret/sector-packs")
}
const VKN = Array.from({ length: 10 }, (_, last) => `123456789${String(last)}`).find(isValidVkn)
// A valid TCKN (the checksum's own example): never handed to the shop
const TCKN = "10000000146"

interface Run {
  id: string
  status: string
  error_code: string | null
  steps?: {
    name: string
    status: string
    created: boolean
    output: Record<string, unknown> | null
  }[]
}

const statusOf = (run: Run) =>
  Object.fromEntries((run.steps ?? []).map((step) => [step.name, step.status]))

/**
 * adr/0063 task 2.7 and audit 1.3: the wizard's "Görünüm" step (each
 * pack's looks and their pictures), a shop made with one of its pack's
 * looks, the setup's `preset` step (applied once, undone with the run)
 * and its `profile` step (the company and owner into the shop's settings,
 * never a TCKN).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    const container = (): MedusaContainer => getContainer()
    const runs = () => container().resolve<ProvisioningModuleService>(PROVISIONING_MODULE)
    const tenants = () => container().resolve<TenantsModuleService>(TENANTS_MODULE)
    let operator: Member
    let readonly: Member

    beforeAll(async () => {
      operator = await makeMember(http, container(), "operator")
      readonly = await makeMember(http, container(), "readonly")
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

    it("lists each pack's looks, the first as the default, and serves their pictures", async () => {
      const answer = await call.get("/admin/cp/sector-packs", readonly)
      const packs = (
        answer.data as {
          sector_packs: { code: string; presets: { code: string; preview: boolean }[] }[]
        }
      ).sector_packs
      expect(packs.find((pack) => pack.code === "general")?.presets).toEqual([])
      const looks = packs.find((pack) => pack.code === "cutlery")?.presets ?? []
      expect(looks.map((look) => look.code)).toEqual(cutlery.presets.map((preset) => preset.code))
      expect(looks[0]).toMatchObject({ code: FIRST.code, name: FIRST.name, preview: true })

      const picture = await call.get(
        `/admin/cp/sector-packs/cutlery/presets/${FIRST.code}/preview`,
        readonly
      )
      expect(picture.status).toBe(200)
      expect(picture.headers["content-type"]).toContain("image/webp")
      expect(picture.headers["x-content-type-options"]).toBe("nosniff")
      for (const path of [
        "cutlery/presets/yok",
        "general/presets/katalog",
        "..%2Fcutlery/presets/katalog",
      ]) {
        expect((await call.get(`/admin/cp/sector-packs/${path}/preview`, readonly)).status).toBe(
          404
        )
      }
    })

    it("makes a shop only with a look of its own pack", async () => {
      const made = await makeTenant(http, operator, { sector_pack: "cutlery", preset: FIRST.code })
      expect((await tenants().tenantOf(made.id)).preset).toBe(FIRST.code)
      for (const body of [
        { sector_pack: "cutlery", preset: "yok" },
        // The general pack has no looks; another pack's is not this shop's
        { preset: FIRST.code },
        { sector_pack: "general", preset: FIRST.code },
        { sector_pack: "cutlery", preset: "../katalog" },
      ]) {
        const refused = await call.post(
          "/admin/cp/tenants",
          { name: "Kalem", slug: freshSlug(), ...body },
          operator,
          await proved(http, operator)
        )
        expect(refused.status).toBe(400)
        expect(JSON.stringify(refused.data)).toContain("cp.preset_unknown")
      }
    })

    it("applies the look once, publishing it on a new shop; a run again leaves it alone", async () => {
      const made = await shop({ sector_pack: "cutlery", preset: FIRST.code })
      const first = await create(made.id)
      expect(first.status).toBe("succeeded")
      const step = first.steps?.find((each) => each.name === "preset")
      expect(step).toMatchObject({ status: "succeeded", created: true })
      expect(step?.output).toMatchObject({
        pack: "cutlery",
        preset: FIRST.code,
        version: FIRST.version,
        published: true,
      })
      const tenant = await tenants().tenantOf(made.id)
      expect(tenant).toMatchObject({ preset: FIRST.code, preset_version: FIRST.version })
      expect(tenant.preset_applied_at).not.toBeNull()
      expect(fakeState().shops.get(made.id)?.presets).toEqual([`cutlery/${FIRST.code}`])

      const again = await create(made.id)
      expect(statusOf(again)).toMatchObject({ preset: "skipped", profile: "skipped" })
      expect(fakeState().shops.get(made.id)?.presets).toHaveLength(1)
    })

    it("takes the pack's first look when none is said, and skips it when none is chosen", async () => {
      const defaulted = await makeTenant(http, operator, { sector_pack: "cutlery" })
      expect((await tenants().tenantOf(defaulted.id)).preset).toBe(FIRST.code)
      const general = await makeTenant(http, operator, {})
      expect((await tenants().tenantOf(general.id)).preset).toBeNull()

      const made = await shop({ sector_pack: "cutlery", preset: null })
      const run = await create(made.id)
      expect(statusOf(run)).toMatchObject({ sector_pack: "succeeded", preset: "skipped" })
      expect(fakeState().shops.get(made.id)?.presets).toEqual([])
    })

    it("forgets the look with a failed run, and the retry applies it again", async () => {
      const made = await shop({ sector_pack: "cutlery", preset: FIRST.code })
      fakeState().failOn = "start"
      const failed = await create(made.id)
      expect(failed.status).toBe("failed")
      expect(statusOf(failed)).toMatchObject({ preset: "compensated", start: "failed" })
      expect((await tenants().tenantOf(made.id)).preset_applied_at).toBeNull()

      const retried = await create(made.id)
      expect(retried.status).toBe("succeeded")
      expect(statusOf(retried)).toMatchObject({ preset: "succeeded" })
      expect((await tenants().tenantOf(made.id)).preset_applied_at).not.toBeNull()
    })

    it("hands the company and owner to the shop, never a TCKN, and only counts come back", async () => {
      const company = await shop({})
      const saved = await call.post(
        `/admin/cp/tenants/${company.id}/company`,
        {
          kind: "company",
          legal_name: "Atölye Bıçak Ltd. Şti.",
          tax_office: "Kadıköy",
          tax_number: VKN,
          address_line: "Moda Cad. No:1",
          district: "Kadıköy",
          city: "İstanbul",
          postal_code: "34710",
        },
        operator
      )
      expect(saved.status).toBe(200)
      const run = await create(company.id)
      const step = run.steps?.find((each) => each.name === "profile")
      expect(step).toMatchObject({ status: "succeeded" })
      expect(step?.output).toMatchObject({ filled: 6, kept: 0, refused: 0 })
      const sent = JSON.parse(fakeState().shops.get(company.id)?.profiles[0] ?? "{}") as unknown
      expect(sent).toEqual({
        legal: {
          company_title: "Atölye Bıçak Ltd. Şti.",
          tax_office: "Kadıköy",
          tax_number: VKN,
          address: "Moda Cad. No:1, 34710 Kadıköy/İstanbul",
        },
        store: {
          contact_email: expect.stringContaining("@example.com") as string,
          contact_phone: "+905321234567",
        },
      })
      // Values stay out of the run's record
      expect(JSON.stringify(run)).not.toContain("Moda Cad.")

      const sole = await shop({})
      expect(
        (
          await call.post(
            `/admin/cp/tenants/${sole.id}/company`,
            { kind: "sole_proprietor", legal_name: "Ayşe Yılmaz", tckn: TCKN, city: "İzmir" },
            operator
          )
        ).status
      ).toBe(200)
      await create(sole.id)
      const document = fakeState().shops.get(sole.id)?.profiles[0] ?? ""
      expect(document).not.toContain(TCKN)
      expect(JSON.parse(document)).toMatchObject({
        legal: { company_title: "Ayşe Yılmaz", address: "İzmir" },
      })
      expect((JSON.parse(document) as { legal: object }).legal).not.toHaveProperty("tax_number")
    })
  },
})
