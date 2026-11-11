import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { runTenantCommand } from "../../src/scripts/tenant"
import { ensureSigningKey, fleetOf } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, freshSlug, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const REASON = "Sözleşme ihlali incelemesi"

/**
 * adr/0061 §2, Ek C15: staff suspend a shop and end its suspension, by
 * hand: owner and operator, behind a step-up, a reason required, only
 * along the lifecycle's transitions; each move recorded and the shop's
 * plan document issued again with the new status.
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

    const tenants = () => getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)
    const latest = (tenantId: string) => fleetOf(getContainer()).latestPlanDocument(tenantId)

    /** An active shop on a package (so it has a plan document). */
    async function activeShop(): Promise<string> {
      const made = await call.post(
        "/admin/cp/plans",
        { code: freshSlug("paket"), name: "Paket", price: 49_000, period: "monthly" },
        finance,
        await proved(http, finance)
      )
      const packageId = (made.data as { plan: { id: string } }).plan.id
      const tenant = await makeTenant(http, operator, { package_id: packageId })
      await tenants().changeStatus(tenant.id, "active", {
        reason_code: "provisioned",
        actor: "system",
      })
      return tenant.id
    }

    const move = async (
      id: string,
      action: "suspend" | "resume",
      member: Member,
      body: unknown = { reason: REASON }
    ) => call.post(`/admin/cp/tenants/${id}/${action}`, body, member, await proved(http, member))

    const statusOf = async (id: string): Promise<TenantStatus> =>
      (await tenants().tenantOf(id)).status

    it("suspends an active shop: the row, the audit and a new document saying so", async () => {
      const id = await activeShop()
      const before = await latest(id)

      const answer = await move(id, "suspend", operator)

      expect(answer.status).toBe(200)
      expect(answer.data).toMatchObject({ tenant: { id, status: "suspended" } })
      expect(await statusOf(id)).toBe("suspended")
      const document = await latest(id)
      expect(document?.serial).toBe((before?.serial ?? 0) + 1)
      expect(document?.document).toMatchObject({ tenant_id: id, status: "suspended" })
      const [row] = await tenants().listTenantStatusChanges(
        { tenant_id: id, to_status: "suspended" },
        { take: 1 }
      )
      expect(row).toMatchObject({
        from_status: "active",
        reason_code: "staff_suspend",
        note: REASON,
        actor: operator.userId,
      })
      const audit = await auditRows(getContainer(), {
        action: "POST /admin/cp/tenants/:id/suspend",
        resource_id: id,
      })
      expect(audit).toHaveLength(1)
      expect(audit[0]).toMatchObject({
        outcome: 200,
        changes: { status: { from: "active", to: "suspended" } },
      })
      // The reason stays on the status row; the activity shows it
      const activity = await call.get(`/admin/cp/tenants/${id}/activity`, readonly)
      expect(JSON.stringify(activity.data)).toContain(REASON)
    })

    it("ends a suspension where the shop stood: active, or restricted if it was", async () => {
      const active = await activeShop()
      await move(active, "suspend", owner)
      const reopened = await move(active, "resume", owner)

      const restricted = await activeShop()
      await tenants().changeStatus(restricted, "restricted", {
        reason_code: "payment_overdue",
        actor: "system",
      })
      await move(restricted, "suspend", owner)
      const stillRestricted = await move(restricted, "resume", operator)

      expect(reopened.data).toMatchObject({ tenant: { status: "active" } })
      expect((await latest(active))?.document).toMatchObject({ status: "active" })
      expect(stillRestricted.data).toMatchObject({ tenant: { status: "restricted" } })
      expect((await latest(restricted))?.document).toMatchObject({ status: "restricted" })
    })

    it("moves only along the lifecycle: 409 cp.status_transition otherwise", async () => {
      const id = await activeShop()
      const notSuspended = await move(id, "resume", operator)
      await move(id, "suspend", operator)
      const twice = await move(id, "suspend", operator)
      const provisioning = await makeTenant(http, operator)
      const notYet = await move(provisioning.id, "suspend", operator)

      for (const answer of [notSuspended, twice, notYet]) {
        expect(answer.status).toBe(409)
        expect(answer.data).toMatchObject({ message: "cp.status_transition" })
      }
      expect(await statusOf(id)).toBe("suspended")
      expect(await statusOf(provisioning.id)).toBe("provisioning")
    })

    it("does the same from a terminal, recorded as the system's (cp:tenant)", async () => {
      const id = await activeShop()
      const { slug } = await tenants().tenantOf(id)
      const quiet = jest.spyOn(process.stdout, "write").mockImplementation(() => true)
      try {
        const noReason = await runTenantCommand(getContainer(), ["suspend", slug])
        const suspended = await runTenantCommand(getContainer(), [
          "suspend",
          slug,
          `reason=${REASON}`,
        ])
        expect(noReason).toBe(2)
        expect(suspended).toBe(0)
      } finally {
        quiet.mockRestore()
      }
      expect(await statusOf(id)).toBe("suspended")
      expect((await latest(id))?.document).toMatchObject({ status: "suspended" })
      const audit = await auditRows(getContainer(), { action: "tenant.suspend", resource_id: id })
      expect(audit[0]).toMatchObject({ actor_type: "system" })
    })

    it("asks for a step-up, a reason and a role that runs shops", async () => {
      const id = await activeShop()
      const plain = await call.post(`/admin/cp/tenants/${id}/suspend`, { reason: REASON }, operator)
      const noReason = await move(id, "suspend", operator, {})
      const short = await move(id, "suspend", operator, { reason: "x" })
      const byFinance = await move(id, "suspend", finance)
      const byReader = await move(id, "suspend", readonly)

      expect(plain.status).toBe(428)
      expect(noReason.status).toBe(400)
      expect(short.status).toBe(400)
      expect(byFinance.status).toBe(403)
      expect(byReader.status).toBe(403)
      expect(await statusOf(id)).toBe("active")
    })
  },
})
