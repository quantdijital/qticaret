import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CP_AUDIT_MODULE } from "../../src/modules/cp-audit"
import type CpAuditModuleService from "../../src/modules/cp-audit/service"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { makeMember, stepUp } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { TEST_TCKN, auditRows, client, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

/**
 * adr/0061 §2, §3.5, Ek C4 L6 (C7): a sole proprietor's TCKN sealed at
 * rest, masked in every answer, shown only to owner, operator and finance
 * behind a step-up, its read recorded before the answer and not shown at
 * all when it cannot be; refusals recorded as reads, a number that cannot
 * be opened leaves no "shown" row, twenty an hour per member.
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

    const detail = async (id: string) =>
      (await call.get(`/admin/cp/tenants/${id}`, readonly)).data as unknown as {
        company: Record<string, unknown> | null
      }

    describe("a sole proprietor's TCKN", () => {
      let id: string

      beforeEach(async () => {
        id = (await makeTenant(http, owner)).id
        const saved = await call.post(
          `/admin/cp/tenants/${id}/company`,
          { kind: "sole_proprietor", legal_name: "Ayşe Yılmaz", tckn: TEST_TCKN },
          operator
        )
        expect(saved.status).toBe(200)
      })

      const reveal = (member: Member, headers?: Record<string, string>) =>
        call.post(`/admin/cp/tenants/${id}/reveal-tckn`, {}, member, headers)

      it("is sealed at rest and masked in every answer", async () => {
        const shop = await call.get(`/admin/cp/tenants/${id}`, readonly)
        const row = await getContainer().resolve<TenantsModuleService>(TENANTS_MODULE).companyOf(id)

        expect(JSON.stringify(shop.data)).not.toContain(TEST_TCKN)
        expect((shop.data as unknown as { company: unknown }).company).toMatchObject({
          tckn_masked: "*******0146",
        })
        expect(row?.tckn_sealed).toMatch(/^qtenv1\./)
        expect(row?.tckn_sealed).not.toContain(TEST_TCKN)
        expect(row?.tckn_last4).toBe("0146")
      })

      it("is refused to readonly and asks the step-up of the others, refusals recorded", async () => {
        expect((await reveal(readonly)).status).toBe(403)
        const unproved = await reveal(finance)

        expect(unproved.status).toBe(428)
        expect(unproved.data).toMatchObject({ message: "cp.step_up_required" })
        expect(
          await auditRows(getContainer(), {
            action: "POST /admin/cp/tenants/:id/reveal-tckn",
            resource_id: id,
            outcome: 428,
            // Recorded as the read it refused (review L1)
            kind: "sensitive_read",
          })
        ).toHaveLength(1)
      })

      it("is shown with a step-up, its read recorded before the answer", async () => {
        const answer = await reveal(finance, await stepUp(http, finance))
        // No wait: the row must be there as the answer arrives
        const rows = await auditRows(
          getContainer(),
          { kind: "sensitive_read", resource_type: "tenant", resource_id: id },
          0
        )

        expect(answer.status).toBe(200)
        expect(answer.data).toEqual({ tckn: TEST_TCKN })
        expect(answer.headers["cache-control"]).toBe("no-store")
        expect(
          rows.filter((row) => row.action === "POST /admin/cp/tenants/:id/reveal-tckn")
        ).toEqual([expect.objectContaining({ actor_id: finance.userId, outcome: 200 })])
      })

      it("is not shown when its read cannot be recorded", async () => {
        const proved = await stepUp(http, owner)
        // The step-up's own row is written once its answer has gone
        await new Promise((resolve) => setTimeout(resolve, 300))
        const audit = getContainer().resolve<CpAuditModuleService>(CP_AUDIT_MODULE)
        const spy = jest.spyOn(audit, "record").mockRejectedValueOnce(new Error("db down"))
        try {
          const answer = await reveal(owner, proved)

          expect(answer.status).toBe(503)
          expect(answer.data).toEqual({ type: "unavailable", message: "cp.audit_unavailable" })
        } finally {
          spy.mockRestore()
        }
      })

      it("leaves no shown row for a number that cannot be opened (review L1)", async () => {
        const service = getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)
        const other = (await makeTenant(http, owner)).id
        // Another shop's sealed number copied onto this one: bound to its shop, it does not open
        const sealed = (await service.companyOf(id))?.tckn_sealed ?? null
        await service.saveCompany(other, {
          kind: "sole_proprietor",
          tckn_sealed: sealed,
          tckn_last4: "0146",
        })

        const answer = await call.post(
          `/admin/cp/tenants/${other}/reveal-tckn`,
          {},
          owner,
          await proved(http, owner)
        )
        const rows = await auditRows(getContainer(), {
          action: "POST /admin/cp/tenants/:id/reveal-tckn",
          resource_id: other,
        })

        expect(answer.status).toBe(500)
        expect(JSON.stringify(answer.data)).not.toContain(TEST_TCKN)
        expect(rows.map((row) => [row.kind, row.outcome])).toEqual([["sensitive_read", 500]])
      })

      it("is shown twenty times an hour per member, the next refused and recorded (review L1)", async () => {
        const reader = await makeMember(http, getContainer(), "operator")
        const headers = await proved(http, reader)
        for (let shown = 0; shown < 20; shown++) {
          expect((await reveal(reader, headers)).status).toBe(200)
        }

        const refused = await reveal(reader, headers)
        const rows = await auditRows(getContainer(), {
          action: "POST /admin/cp/tenants/:id/reveal-tckn",
          actor_id: reader.userId,
          outcome: 429,
        })

        expect(refused.status).toBe(429)
        expect(refused.data).not.toHaveProperty("tckn")
        expect(rows.map((row) => row.kind)).toEqual(["sensitive_read"])
      })

      it("goes when the company becomes a company", async () => {
        await call.post(`/admin/cp/tenants/${id}/company`, { kind: "company" }, owner)

        expect((await detail(id)).company).toMatchObject({ kind: "company", tckn_masked: null })
        expect((await reveal(owner, await stepUp(http, owner))).status).toBe(404)
      })
    })
  },
})
