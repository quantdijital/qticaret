import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { checkDueDomains } from "../../src/lib/domains/checks"
import { DNS_FAKE_ENV } from "../../src/lib/domains/dns"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { ensureSigningKey, fleetOf } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, freshSlug, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

type Knex = (table: string) => {
  where: (row: Record<string, unknown>) => {
    update: (row: Record<string, unknown>) => Promise<number>
  }
}

interface DomainView {
  id: string
  hostname: string
  kind: string
  verification: string
  verification_error: string | null
  is_primary: boolean
  verification_token?: string
  dns: {
    txt: { name: string; value: string }
    routing: { type: string; name: string; values: string[] } | null
  } | null
}

/** The fake DNS's answers for this process (NODE_ENV=test only, lib/domains/dns.ts). */
function answer(records: Record<string, unknown>): void {
  process.env[DNS_FAKE_ENV] = JSON.stringify(records)
}

/**
 * F16.7: a custom domain's DNS proof. The owner sees the TXT record to
 * publish and where to point; "Doğrula" and the job ask DNS only; proved,
 * it may be primary and the shop's plan document carries it; primary and
 * removal are proved again (step-up) and recorded.
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

    afterEach(() => {
      process.env[DNS_FAKE_ENV] = ""
      delete process.env["CP_DOMAIN_CNAME_TARGET"]
    })

    const domainsOf = async (id: string) =>
      (
        (await call.get(`/admin/cp/tenants/${id}`, readonly)).data as unknown as {
          domains: DomainView[]
        }
      ).domains

    async function shopWithDomain() {
      const made = await call.post(
        "/admin/cp/plans",
        { code: freshSlug("paket"), name: "Paket", price: 49_000, period: "monthly" },
        finance,
        await proved(http, finance)
      )
      const packageId = (made.data as { plan: { id: string } }).plan.id
      const tenant = await makeTenant(http, operator, { package_id: packageId })
      const host = `${freshSlug("www")}.com.tr`
      const added = await call.post(
        `/admin/cp/tenants/${tenant.id}/domains`,
        { hostname: host },
        operator
      )
      const domainId = (added.data as { domain: { id: string } }).domain.id
      return { tenant, host, domainId }
    }

    it("shows the TXT record to publish and where to point, never the token alone", async () => {
      const { tenant, host, domainId } = await shopWithDomain()
      process.env["CP_DOMAIN_CNAME_TARGET"] = "edge.quantticaret.com"

      const domains = await domainsOf(tenant.id)
      const own = domains.find((each) => each.id === domainId)
      const platform = domains.find((each) => each.kind === "platform_subdomain")

      expect(own).toMatchObject({ verification: "pending", verification_error: null })
      expect(own?.dns?.txt.name).toBe(`_qticaret-verify.${host}`)
      expect(own?.dns?.txt.value).toMatch(/^qticaret-verify=[0-9a-f]{32}$/)
      expect(own?.dns?.routing).toEqual({
        type: "CNAME",
        name: host,
        values: ["edge.quantticaret.com"],
      })
      expect(own && "verification_token" in own).toBe(false)
      expect(platform?.dns).toBeNull()
    })

    it("checks by DNS on 'Doğrula': pending with the reason, then verified, then primary", async () => {
      const { tenant, host, domainId } = await shopWithDomain()
      const path = `/admin/cp/tenants/${tenant.id}/domains/${domainId}`
      const txtName = `_qticaret-verify.${host}`
      const value = (await domainsOf(tenant.id)).find((each) => each.id === domainId)?.dns?.txt
        .value

      expect((await call.post(`${path}/check`, {}, readonly)).status).toBe(403)
      answer({ [txtName]: { txt: [["qticaret-verify=someoneelse"]] } })
      expect((await call.post(`${path}/check`, {}, operator)).data).toMatchObject({
        domain: { verification: "pending", verification_error: "txt_mismatch" },
      })
      answer({ [txtName]: { fail: true } })
      expect((await call.post(`${path}/check`, {}, operator)).data).toMatchObject({
        domain: { verification: "pending", verification_error: "dns_unavailable" },
      })
      const before = (await fleetOf(getContainer()).latestPlanDocument(tenant.id))?.serial ?? 0

      answer({ [txtName]: { txt: [[value ?? ""]] } })
      const proved_ = await call.post(`${path}/check`, {}, operator)

      expect(proved_.status).toBe(200)
      expect(proved_.data).toMatchObject({
        domain: { verification: "verified", verification_error: null },
      })
      // The shop's document now names its proved hosts
      const document = await fleetOf(getContainer()).latestPlanDocument(tenant.id)
      expect(document?.serial).toBeGreaterThan(before)
      expect((document?.document as { domains?: { hosts: string[] } }).domains?.hosts).toContain(
        host
      )

      // Primary: proved again
      expect((await call.post(`${path}/primary`, {}, operator)).status).toBe(428)
      expect(
        (await call.post(`${path}/primary`, {}, operator, await proved(http, operator))).data
      ).toMatchObject({ primary: host })
      const primary = await fleetOf(getContainer()).latestPlanDocument(tenant.id)
      expect((primary?.document as { domains?: { primary: string } }).domains?.primary).toBe(host)

      const audit = await auditRows(getContainer(), {
        action: "POST /admin/cp/tenants/:id/domains/:domain_id/check",
        resource_id: tenant.id,
      })
      expect(audit.at(-1)).toMatchObject({
        outcome: 200,
        changes: { domain_check: { host, from: "pending", to: "verified" } },
      })
    })

    it("removes a proved primary domain with a step-up; the subdomain becomes primary again", async () => {
      const { tenant, host, domainId } = await shopWithDomain()
      const path = `/admin/cp/tenants/${tenant.id}/domains/${domainId}`
      const value = (await domainsOf(tenant.id)).find((each) => each.id === domainId)?.dns?.txt
        .value
      answer({ [`_qticaret-verify.${host}`]: { txt: [[value ?? ""]] } })
      await call.post(`${path}/check`, {}, owner)
      const sure = await proved(http, owner)
      await call.post(`${path}/primary`, {}, owner, sure)

      expect((await call.delete(path, owner)).status).toBe(428)
      expect((await call.delete(path, owner, sure)).status).toBe(200)
      const domains = await domainsOf(tenant.id)
      expect(domains).toHaveLength(1)
      expect(domains[0]).toMatchObject({ kind: "platform_subdomain", is_primary: true })
      // No proved domain of its own: the document drops the field again
      const document = await fleetOf(getContainer()).latestPlanDocument(tenant.id)
      expect(document?.document).not.toHaveProperty("domains")
    })

    it("re-checks due domains on the job and fails one unproved past its week", async () => {
      const { tenant, host, domainId } = await shopWithDomain()
      const service = getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)
      const week = 7 * 24 * 60 * 60 * 1000
      await service.updateTenantDomains({
        id: domainId,
        next_check_at: new Date(Date.now() - 1000),
      })
      answer({})

      await checkDueDomains(getContainer())
      expect((await domainsOf(tenant.id)).find((each) => each.id === domainId)).toMatchObject({
        verification: "pending",
        verification_error: "txt_missing",
      })

      await service.updateTenantDomains({
        id: domainId,
        next_check_at: new Date(Date.now() - 1000),
      })
      // Recorded over a week ago (the rule reads the row's own day)
      await getContainer()
        .resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)("tenant_domain")
        .where({ id: domainId })
        .update({ created_at: new Date(Date.now() - week - 60_000) })
      await checkDueDomains(getContainer())
      const failed = (await domainsOf(tenant.id)).find((each) => each.id === domainId)
      expect(failed).toMatchObject({ verification: "failed", verification_error: "expired" })

      // A manual check may still prove it
      const value = failed?.dns?.txt.value ?? ""
      answer({ [`_qticaret-verify.${host}`]: { txt: [[value]] } })
      expect(
        (await call.post(`/admin/cp/tenants/${tenant.id}/domains/${domainId}/check`, {}, operator))
          .data
      ).toMatchObject({ domain: { verification: "verified" } })
    })

    it("takes back a primary domain whose proof is gone two weeks; the subdomain is primary again", async () => {
      const { tenant, host, domainId } = await shopWithDomain()
      const path = `/admin/cp/tenants/${tenant.id}/domains/${domainId}`
      const value = (await domainsOf(tenant.id)).find((each) => each.id === domainId)?.dns?.txt
        .value
      answer({ [`_qticaret-verify.${host}`]: { txt: [[value ?? ""]] } })
      await call.post(`${path}/check`, {}, owner)
      await call.post(`${path}/primary`, {}, owner, await proved(http, owner))
      const service = getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)
      await service.updateTenantDomains({
        id: domainId,
        txt_lost_since: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        next_check_at: new Date(Date.now() - 1000),
      })
      answer({})

      await checkDueDomains(getContainer())

      const domains = await domainsOf(tenant.id)
      expect(domains.find((each) => each.id === domainId)).toMatchObject({
        verification: "failed",
        verification_error: "txt_lost",
        is_primary: false,
      })
      expect(domains.find((each) => each.kind === "platform_subdomain")?.is_primary).toBe(true)
      const document = await fleetOf(getContainer()).latestPlanDocument(tenant.id)
      expect(document?.document).not.toHaveProperty("domains")
    })

    it("refuses to check the platform subdomain or another shop's domain", async () => {
      const { tenant } = await shopWithDomain()
      const other = await shopWithDomain()
      const platform = (await domainsOf(tenant.id)).find(
        (each) => each.kind === "platform_subdomain"
      )

      expect(
        (
          await call.post(
            `/admin/cp/tenants/${tenant.id}/domains/${platform?.id ?? ""}/check`,
            {},
            operator
          )
        ).data
      ).toMatchObject({ message: "cp.domain_platform_kept" })
      expect(
        (
          await call.post(
            `/admin/cp/tenants/${tenant.id}/domains/${other.domainId}/check`,
            {},
            operator
          )
        ).status
      ).toBe(404)
    })
  },
})
