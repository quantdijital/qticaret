import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { TEST_TCKN, TEST_VKN, client, freshSlug, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

interface Detail {
  tenant: { status: string; slug: string }
  company: Record<string, unknown> | null
  contacts: { id: string; name: string; phone: string | null; is_primary_billing: boolean }[]
  domains: {
    id: string
    hostname: string
    kind: string
    verification: string
    is_primary: boolean
  }[]
}

/**
 * adr/0061 §2, §3.5 (C7): shops as records, by role; validation; the
 * company; contacts and their primary billing mark; domains under the
 * platform and the shop's own. The TCKN: tenants-tckn.spec.ts.
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

    const detail = async (id: string, member: Member = readonly) =>
      (await call.get(`/admin/cp/tenants/${id}`, member)).data as unknown as Detail

    it.each([
      ["owner", 200],
      ["operator", 200],
      ["finance", 403],
      ["readonly", 403],
    ] as const)(
      "lets %s make a shop record: %i; every role reads the list",
      async (role, status) => {
        const member = { owner, operator, finance, readonly }[role]
        const body = { name: "Kalem Evi", slug: freshSlug() }
        // A record may name its package: the step-up is asked of who may make one (review M1)
        const unproved = await call.post("/admin/cp/tenants", body, member)
        const made =
          status === 200
            ? await call.post("/admin/cp/tenants", body, member, await proved(http, member))
            : unproved
        const list = await call.get("/admin/cp/tenants?q=kalem", member)

        expect(unproved.status).toBe(status === 200 ? 428 : 403)
        expect(made.status).toBe(status)
        expect(list.status).toBe(200)
        if (status === 403) {
          expect(made.data).toMatchObject({ message: "cp.forbidden" })
        }
      }
    )

    it("makes it provisioning, on its platform subdomain, with its first status row", async () => {
      const { id, slug } = await makeTenant(http, operator)
      const shop = await detail(id)
      const list = await call.get(`/admin/cp/tenants?status=provisioning&q=${slug}`, owner)
      const activity = await call.get(`/admin/cp/tenants/${id}/activity`, readonly)

      expect(shop.tenant).toMatchObject({ status: "provisioning", slug })
      expect(shop.domains).toEqual([
        expect.objectContaining({
          hostname: `${slug}.localhost`,
          kind: "platform_subdomain",
          verification: "verified",
          is_primary: true,
        }),
      ])
      expect(list.data).toMatchObject({
        count: 1,
        tenants: [{ id, primary_hostname: `${slug}.localhost` }],
      })
      expect(
        (list.data as { counts: Record<string, number> }).counts["provisioning"]
      ).toBeGreaterThan(0)
      expect(activity.data).toMatchObject({
        items: [
          { kind: "status", from_status: null, to_status: "provisioning", reason_code: "created" },
        ],
      })
    })

    it.each([
      [{ name: "A", slug: "ab" }, "cp.slug_invalid"],
      [{ name: "A", slug: "www" }, "cp.slug_reserved"],
      [{ name: "", slug: "kirtasiye" }, "name"],
      [{ name: "A", slug: "kirtasiye", status: "active" }, "status"],
    ])("refuses a record %j (400)", async (body, key) => {
      const answer = await call.post("/admin/cp/tenants", body, owner, await proved(http, owner))

      expect(answer.status).toBe(400)
      expect(JSON.stringify(answer.data)).toContain(key)
    })

    it("refuses a slug taken (422) and a package that does not exist (404), undone", async () => {
      const { slug } = await makeTenant(http, owner)
      const other = freshSlug()

      const headers = await proved(http, owner)
      const again = await call.post("/admin/cp/tenants", { name: "B", slug }, owner, headers)
      const noPackage = await call.post(
        "/admin/cp/tenants",
        { name: "B", slug: other, package_id: "pkg_none" },
        owner,
        headers
      )

      expect(again.status).toBe(422)
      expect(again.data).toMatchObject({ message: "cp.slug_taken" })
      expect(noPackage.status).toBe(404)
      expect(noPackage.data).toMatchObject({ message: "cp.package_unknown" })
      // The record the failed workflow made is gone again
      expect((await call.get(`/admin/cp/tenants?q=${other}`, owner)).data).toMatchObject({
        count: 0,
      })
    })

    it("keeps the company's VKN checked, a TCKN for sole proprietors only, and gives finance the company", async () => {
      const { id } = await makeTenant(http, owner)
      const path = `/admin/cp/tenants/${id}/company`

      expect(
        JSON.stringify((await call.post(path, { tax_number: "1234567891" }, owner)).data)
      ).toContain("cp.vkn_invalid")
      expect((await call.post(path, { tckn: TEST_TCKN }, owner)).data).toMatchObject({
        message: "cp.tckn_company",
      })
      expect((await call.post(path, { legal_name: "X" }, readonly)).status).toBe(403)
      const saved = await call.post(
        path,
        {
          legal_name: "Atölye Bıçak Ltd. Şti.",
          tax_office: "Kadıköy",
          tax_number: TEST_VKN,
          city: "İstanbul",
          postal_code: "34710",
        },
        finance
      )

      expect(saved.status).toBe(200)
      expect(saved.data).toMatchObject({
        company: { kind: "company", tax_number: TEST_VKN, tckn_masked: null },
      })
    })

    it("keeps one primary billing contact, phones in E.164, and removes a contact for good", async () => {
      const { id } = await makeTenant(http, owner)
      const path = `/admin/cp/tenants/${id}/contacts`
      const person = {
        name: "Deniz Kaya",
        role: "owner",
        email: "Deniz@Mylarte.com",
        phone: "0532 123 45 67",
      }

      expect(
        JSON.stringify((await call.post(path, { ...person, phone: "123" }, operator)).data)
      ).toContain("cp.phone_invalid")
      expect((await call.post(path, person, finance)).status).toBe(403)
      const first = await call.post(path, person, operator)
      const second = await call.post(
        path,
        {
          name: "Ece Demir",
          role: "billing",
          email: "muhasebe@mylarte.com",
          is_primary_billing: true,
        },
        operator
      )
      const firstId = (first.data as { contact: { id: string } }).contact.id
      const secondId = (second.data as { contact: { id: string } }).contact.id
      const both = (await detail(id, operator)).contacts

      expect(both).toEqual([
        expect.objectContaining({
          id: firstId,
          phone: "+905321234567",
          email: "deniz@mylarte.com",
          is_primary_billing: false,
        }),
        expect.objectContaining({ id: secondId, phone: null, is_primary_billing: true }),
      ])
      expect((await call.delete(`${path}/${secondId}`, operator)).status).toBe(200)
      expect((await detail(id)).contacts).toEqual([
        expect.objectContaining({ id: firstId, is_primary_billing: true }),
      ])
      const removed = await getContainer()
        .resolve<TenantsModuleService>(TENANTS_MODULE)
        .listTenantContacts({ id: secondId }, { withDeleted: true })
      expect(removed).toHaveLength(0)
      // A person's data never stays behind as a workflow's execution
      const executions = await getContainer()
        .resolve(Modules.WORKFLOW_ENGINE)
        .listWorkflowExecutions({
          workflow_id: ["cp-tenant-save-contact", "cp-tenant-remove-contact"],
        })
      expect(executions).toHaveLength(0)
    })

    it("records custom domains as pending, primary only once verified, the subdomain kept", async () => {
      const { id } = await makeTenant(http, owner)
      const other = await makeTenant(http, owner)
      const path = `/admin/cp/tenants/${id}/domains`
      const host = `${freshSlug("www")}.com.tr`

      const added = await call.post(path, { hostname: ` ${host.toUpperCase()}. ` }, operator)
      const domainId = (added.data as { domain: { id: string } }).domain.id
      const domains = (await detail(id)).domains
      const platform = domains.find((each) => each.kind === "platform_subdomain")

      expect(added.status).toBe(200)
      expect(domains.find((each) => each.id === domainId)).toMatchObject({
        hostname: host,
        verification: "pending",
        is_primary: false,
      })
      expect(
        (await call.post(`/admin/cp/tenants/${other.id}/domains`, { hostname: host }, owner)).data
      ).toMatchObject({
        message: "cp.domain_taken",
      })
      expect((await call.post(path, { hostname: "magaza.localhost" }, owner)).status).toBe(400)
      expect(
        (await call.post(`${path}/${domainId}/primary`, {}, operator, await proved(http, operator)))
          .data
      ).toMatchObject({
        message: "cp.domain_unverified",
      })
      const sure = await proved(http, operator)
      expect(
        (await call.delete(`${path}/${platform?.id ?? ""}`, operator, sure)).data
      ).toMatchObject({
        message: "cp.domain_platform_kept",
      })
      expect((await call.delete(`${path}/${domainId}`, readonly)).status).toBe(403)
      // F16.7: removing an address is proved again
      expect((await call.delete(`${path}/${domainId}`, operator)).status).toBe(428)
      expect((await call.delete(`${path}/${domainId}`, operator, sure)).status).toBe(200)
      expect((await detail(id)).domains).toHaveLength(1)
    })

    it("answers 404 for a shop that does not exist", async () => {
      expect((await call.get("/admin/cp/tenants/ten_none", owner)).data).toMatchObject({
        message: "cp.tenant_unknown",
      })
    })
  },
})
