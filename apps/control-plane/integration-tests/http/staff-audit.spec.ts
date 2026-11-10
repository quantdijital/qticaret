import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CP_AUDIT_MODULE } from "../../src/modules/cp-audit"
import type CpAuditModuleService from "../../src/modules/cp-audit/service"
import { anyStatus, makeMember, stepUp } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"

jest.setTimeout(180 * 1000)

/**
 * adr/0061 §3.5 (C4, Ek C4 L6): every mutation leaves an audit row,
 * refused ones too, with field names but no values, and a change of role
 * or standing from and to.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Member
    let operator: Member
    let finance: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      operator = await makeMember(http, getContainer(), "operator")
      finance = await makeMember(http, getContainer(), "finance")
    })

    const rowsOf = async (filters: Record<string, unknown>) => {
      // The row is written once the answer has gone
      await new Promise((resolve) => setTimeout(resolve, 200))
      const [rows] = await getContainer()
        .resolve<CpAuditModuleService>(CP_AUDIT_MODULE)
        .listAndCountCpAuditEntries(filters, { order: { created_at: "ASC" }, take: 50 })
      return rows
    }

    it("records a role change and a deactivation from and to (L6)", async () => {
      const proved = await stepUp(http, owner)
      const post = (path: string, body: object) =>
        http.post(`/admin/cp/staff/members/${finance.userId}${path}`, body, {
          ...anyStatus,
          headers: proved,
        })
      await post("", { role: "readonly" })
      await post("", { role: "finance" })
      await post("/deactivate", {})
      await post("/reactivate", {})

      const roles = await rowsOf({
        action: "POST /admin/cp/staff/members/:id",
        resource_id: finance.userId,
      })
      const standing = await rowsOf({
        resource_id: finance.userId,
        resource_type: "cp_staff_member",
      })

      expect(roles.map((row) => (row.changes as { role?: unknown } | null)?.role)).toEqual([
        { from: "finance", to: "readonly" },
        { from: "readonly", to: "finance" },
      ])
      expect(
        standing.map((row) => (row.changes as { active?: unknown } | null)?.active).filter(Boolean)
      ).toEqual([
        { from: true, to: false },
        { from: false, to: true },
      ])
    })

    it("records every mutation, refused ones too, with names but no values", async () => {
      const email = `audit-${randomUUID()}@quant.test`
      const refused = await http.post(
        "/admin/cp/staff/invites",
        { email, role: "readonly" },
        { ...anyStatus, headers: operator.headers }
      )
      const made = await http.post(
        "/admin/cp/staff/invites",
        { email, role: "readonly" },
        { ...anyStatus, headers: await stepUp(http, owner) }
      )
      const rows = await rowsOf({ action: "POST /admin/cp/staff/invites" })
      const byOperator = rows.find((row) => row.actor_id === operator.userId)
      const byOwner = rows.find((row) => row.actor_id === owner.userId && row.outcome === 201)

      expect(refused.status).toBe(403)
      expect(made.status).toBe(201)
      expect(byOperator).toMatchObject({
        kind: "mutation",
        actor_type: "user",
        outcome: 403,
        resource_type: "cp_invite",
        changes: { fields: ["email", "role"] },
      })
      expect(byOwner?.request_id).toEqual(expect.any(String))
      expect(byOwner?.ip_hash).toMatch(/^[0-9a-f]{32}$/)
      expect(JSON.stringify(rows)).not.toContain(email)
      expect(JSON.stringify(rows)).not.toContain("127.0.0.1")

      const listed = await http.get<{ entries: unknown[] }>("/admin/cp/audit-log?limit=5", {
        ...anyStatus,
        headers: owner.headers,
      })
      expect(listed.status).toBe(200)
      expect(listed.data.entries.length).toBe(5)
    })
  },
})
