import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CP_AUDIT_MODULE } from "../../src/modules/cp-audit"
import type CpAuditModuleService from "../../src/modules/cp-audit/service"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, freshSlug, makeTenant } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

interface Contacts {
  contacts: { email: string; phone: string | null }[]
}

/**
 * C7 security review M2 and L5: a shop's page holds its contacts, so the
 * read is recorded before the answer and nothing is shown when it cannot
 * be; a reading role sees their e-mail and phone masked; a shop's contacts
 * and own domains are bounded.
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

    const tenants = () => getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)

    const withContact = async () => {
      const { id } = await makeTenant(http, owner)
      await call.post(
        `/admin/cp/tenants/${id}/contacts`,
        {
          name: "Selin Aydın",
          role: "owner",
          email: "selin@egezeytin.com.tr",
          phone: "0532 418 27 63",
        },
        operator
      )
      return id
    }

    it("masks the contacts' e-mail and phone for a reading role only", async () => {
      const id = await withContact()
      const of = async (member: Member) =>
        ((await call.get(`/admin/cp/tenants/${id}`, member)).data as unknown as Contacts).contacts

      expect(await of(readonly)).toEqual([
        expect.objectContaining({ email: "s***@egezeytin.com.tr", phone: "+90*** *** ** 63" }),
      ])
      for (const member of [owner, operator, finance]) {
        expect(await of(member)).toEqual([
          expect.objectContaining({ email: "selin@egezeytin.com.tr", phone: "+905324182763" }),
        ])
      }
    })

    it("records the read before the answer, and shows nothing when it cannot", async () => {
      const id = await withContact()
      const read = await call.get(`/admin/cp/tenants/${id}`, readonly)
      // No wait: the row is there as the answer arrives
      const rows = await auditRows(
        getContainer(),
        { kind: "sensitive_read", action: "GET /admin/cp/tenants/:id", resource_id: id },
        0
      )
      expect(read.status).toBe(200)
      expect(rows).toEqual([expect.objectContaining({ actor_id: readonly.userId, outcome: 200 })])

      await new Promise((resolve) => setTimeout(resolve, 300))
      const audit = getContainer().resolve<CpAuditModuleService>(CP_AUDIT_MODULE)
      const spy = jest.spyOn(audit, "record").mockRejectedValueOnce(new Error("db down"))
      try {
        const answer = await call.get(`/admin/cp/tenants/${id}`, operator)

        expect(answer.status).toBe(503)
        expect(answer.data).toEqual({ type: "unavailable", message: "cp.audit_unavailable" })
        expect(JSON.stringify(answer.data)).not.toContain("egezeytin")
      } finally {
        spy.mockRestore()
      }
    })

    it("takes fifty contacts and fifty own domains a shop, and says so past them", async () => {
      const { id } = await makeTenant(http, owner)
      await tenants().createTenantContacts(
        Array.from({ length: 50 }, (_, n) => ({
          tenant_id: id,
          name: `Yetkili ${String(n)}`,
          role: "technical" as const,
          email: `yetkili${String(n)}@egezeytin.com.tr`,
          phone: null,
        }))
      )
      await tenants().createTenantDomains(
        Array.from({ length: 50 }, (_, n) => ({
          tenant_id: id,
          hostname: `${freshSlug("alan")}${String(n)}.com.tr`,
          kind: "custom" as const,
        }))
      )

      const contact = await call.post(
        `/admin/cp/tenants/${id}/contacts`,
        { name: "Bir Fazla", role: "billing", email: "fazla@egezeytin.com.tr" },
        operator
      )
      const domain = await call.post(
        `/admin/cp/tenants/${id}/domains`,
        { hostname: `${freshSlug("fazla")}.com.tr` },
        operator
      )
      const shown = (await call.get(`/admin/cp/tenants/${id}`, operator)).data as unknown as {
        contacts: unknown[]
        domains: unknown[]
      }

      expect(contact.data).toMatchObject({ message: "cp.contacts_full" })
      expect(domain.data).toMatchObject({ message: "cp.domains_full" })
      // Every one of them read back: nothing cut short
      expect(shown.contacts).toHaveLength(50)
      expect(shown.domains).toHaveLength(51)
    })
  },
})
