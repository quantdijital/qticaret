import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, freshSlug, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

interface Availability {
  platform_domain: string
  slug?: { value: string; hostname: string; problem: string | null }
  hostname?: { value: string; problem: string | null }
}

/**
 * C11: a new shop's address checked while the wizard is filled in (format,
 * reserved, taken; an own domain too), for who may make a shop, and the
 * sector pack a record keeps.
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
    })

    const check = async (query: string, member: Member = operator) => {
      const answer = await call.get(`/admin/cp/tenant-availability?${query}`, member)
      return {
        status: answer.status,
        body: answer.data as unknown as Availability,
        headers: answer.headers,
      }
    }

    it.each([
      ["owner", 200],
      ["operator", 200],
      ["finance", 403],
      ["readonly", 403],
    ] as const)("answers %s: %i, with no step-up", async (role, status) => {
      const member = { owner, operator, finance, readonly }[role]

      expect((await check(`slug=${freshSlug()}`, member)).status).toBe(status)
    })

    it("says a free slug is free, with its subdomain, and is not cached", async () => {
      const slug = freshSlug("kalem")
      const answer = await check(`slug=${slug}`)

      expect(answer.body).toEqual({
        platform_domain: "localhost",
        slug: { value: slug, hostname: `${slug}.localhost`, problem: null },
      })
      expect(answer.headers["cache-control"]).toBe("no-store")
    })

    it("says what is wrong: format, reserved, taken; an own domain likewise", async () => {
      const { slug } = await makeTenant(http, owner)
      const { id } = await makeTenant(http, owner)
      await call.post(`/admin/cp/tenants/${id}/domains`, { hostname: "kalemevi.com" }, owner)

      const answers = await Promise.all(
        [
          "slug=ab",
          "slug=www",
          `slug=${slug}`,
          "hostname=kalem",
          "hostname=kalem.localhost",
          "hostname=KalemEvi.com",
          "hostname=defter-evi.com.tr",
        ].map((query) => check(query))
      )

      expect(answers.map((each) => each.body.slug?.problem ?? each.body.hostname?.problem)).toEqual(
        [
          "cp.slug_invalid",
          "cp.slug_reserved",
          "cp.slug_taken",
          "cp.domain_invalid",
          "cp.domain_invalid",
          "cp.domain_taken",
          null,
        ]
      )
      expect(answers[5]?.body.hostname?.value).toBe("kalemevi.com")
    })

    it("answers both at once, and the platform's domain with neither", async () => {
      const slug = freshSlug("defter")
      const both = await check(`slug=${slug}&hostname=defter-evi.com.tr`)
      const none = await check("")

      expect(both.body.slug?.problem).toBeNull()
      expect(both.body.hostname?.problem).toBeNull()
      expect(none.body).toEqual({ platform_domain: "localhost" })
    })

    it("refuses an unknown or over-long query (400)", async () => {
      expect((await check("slug=kalem&id=ten_1")).status).toBe(400)
      expect((await check(`slug=${"a".repeat(65)}`)).status).toBe(400)
      expect((await check(`hostname=${"a".repeat(254)}`)).status).toBe(400)
    })

    it("keeps the sector pack a record is made with; refuses one that does not exist", async () => {
      const { id } = await makeTenant(http, operator, { sector_pack: "general" })
      const plain = await makeTenant(http, operator)
      const unknown = await call.post(
        "/admin/cp/tenants",
        { name: "Kalem", slug: freshSlug(), sector_pack: "knives" },
        operator,
        await proved(http, operator)
      )
      const service = getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)
      const detail = await call.get(`/admin/cp/tenants/${id}`, operator)

      expect((await service.tenantOf(id)).sector_pack).toBe("general")
      expect((await service.tenantOf(plain.id)).sector_pack).toBeNull()
      expect(detail.data).toMatchObject({ tenant: { sector_pack: "general" } })
      expect(unknown.status).toBe(400)
    })
  },
})
