import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { signDocument } from "@qticaret/server-kit"
import { SUPPORT_GRANT_PURPOSE } from "@qticaret/types/control-plane"
import type { SupportGrantDocument } from "@qticaret/types/control-plane"
import { TENANT_ID } from "@qticaret/types/control-plane/testing"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { STAFF_ROLES_MODULE } from "../../src/modules/staff-roles"
import type StaffRolesModuleService from "../../src/modules/staff-roles/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import { cp, managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { adminOrigin, keyOf, sessionCookie } from "../helpers/staff-account"
import type { Answer } from "../helpers/staff-account"

jest.setTimeout(240 * 1000)

const REDEEM = "/auth/support-access"

const grant = (over: Partial<SupportGrantDocument> = {}): SupportGrantDocument => {
  const now = Math.floor(Date.now() / 1000)
  return {
    version: 1,
    audience: "shop_panel",
    tenant_id: TENANT_ID,
    grant_id: `sgr_${randomBytes(24).toString("base64url")}`,
    operator: { id: "user_01CPOPERATOR", name: "Ayşe Yılmaz", role: "operator" },
    reason: "Ana sayfa görünümünü ve ilk ürünleri kurmak için",
    issued_at: now,
    expires_at: now + 30 * 60,
    ...over,
  }
}

const encode = (document: SupportGrantDocument) =>
  Buffer.from(
    JSON.stringify({ document, ...signDocument(SUPPORT_GRANT_PURPOSE, document, cp) })
  ).toString("base64url")

/**
 * adr/0061 Ek "Destek erişimi": the control plane's signed grant redeemed
 * once for a time-limited "Platform desteği" session; what it reaches;
 * the owner's switch, list and "end"; the audit trail.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const container = (): MedusaContainer => getContainer()
    const json = { "content-type": "application/json", origin: adminOrigin() }
    const redeem = (encoded: string) =>
      settle(
        http.post<Answer & { support?: { expires_at: string } }>(
          REDEEM,
          { grant: encoded },
          { headers: json }
        )
      )
    const as = (cookie: string) => ({
      get: <T>(url: string) =>
        settle(http.get<T & Answer>(url, { headers: { cookie, origin: adminOrigin() } })),
      post: <T>(url: string, body: unknown = {}) =>
        settle(http.post<T & Answer>(url, body, { headers: { ...json, cookie } })),
      delete: <T>(url: string) =>
        settle(http.delete<T & Answer>(url, { headers: { ...json, cookie } })),
    })
    const settings = () =>
      container().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const audit = () => container().resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)

    managedForThisFile()

    it("refuses support while the owner has not joined, and never makes it the first owner (review H-A)", async () => {
      const roles = () =>
        container().resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).listStaffRoles({})
      expect(await roles()).toHaveLength(0)
      const answer = await redeem(encode(grant()))
      expect([answer.status, keyOf(answer.data)]).toEqual([409, "support.no_owner"])
      // Even asked directly, a support identity claims no role in a shop without staff
      expect(
        await container()
          .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
          .roleOf("qtsup_AAECAwQFBgcICQoLDA0ODxAREhMUFRYX")
      ).toBeNull()
      expect(await roles()).toHaveLength(0)
    })

    it("opens a support session once: who it is, what it reaches, then signing out ends it", async () => {
      const owner = await createAdminUser(http, container())
      const document = grant()
      const first = await redeem(encode(document))
      expect(first.status).toBe(200)
      const cookie = sessionCookie(first)
      expect(cookie).not.toBe("")
      const support = as(cookie)

      // The same grant again is a replay
      const replay = await redeem(encode(document))
      expect([replay.status, keyOf(replay.data)]).toEqual([409, "support.grant_used"])

      const me = await support.get<{ user: { first_name: string; last_name: string } }>(
        "/admin/users/me"
      )
      expect(me.data.user).toMatchObject({
        first_name: "Platform desteği",
        last_name: "Ayşe Yılmaz",
      })
      const staff = await support.get<{
        role: string
        can: Record<string, boolean>
        support: { operator_name: string }
      }>("/admin/staff/me")
      expect(staff.data.support.operator_name).toBe("Ayşe Yılmaz")
      expect(staff.data.can).toMatchObject({ catalog: true, looks: true, staff: false })

      // Design and products: yes. People, secrets, exports, the switch: no
      expect((await support.get("/admin/products")).status).toBe(200)
      expect((await support.get("/admin/storefront-designs")).status).not.toBe(403)
      for (const [method, path] of [
        ["get", "/admin/staff"],
        ["post", "/admin/staff/invites"],
        ["post", "/admin/integrations/credentials/iyzico"],
        ["post", "/admin/customer-export"],
        ["post", "/admin/platform-settings/security"],
        ["get", "/admin/audit-log"],
        ["get", "/admin/support-access"],
        ["post", "/admin/orders/order_1/cancel"],
        ["get", "/admin/wholesale/accounts"],
        ["post", "/admin/platform-settings/store"],
      ] as const) {
        const answer = await support[method](path)
        expect([path, answer.status, keyOf(answer.data)]).toEqual([path, 403, "support.forbidden"])
      }
      // No token minted from the session
      const token = await support.post("/auth/token/refresh")
      expect([token.status, keyOf(token.data)]).toEqual([403, "support.forbidden"])

      // Not on the team, not in its count
      const team = await http.get<{ staff: { id: string }[] }>("/admin/staff", {
        headers: owner.headers,
      })
      expect(team.data.staff.some((member) => member.id.startsWith("qtsup_"))).toBe(false)

      // The owner sees it open, then the session signs out
      const list = await http.get<{ sessions: { grant_id: string }[] }>("/admin/support-access", {
        headers: owner.headers,
      })
      expect(list.data.sessions.map((row) => row.grant_id)).toContain(document.grant_id)
      expect((await support.delete("/auth/session")).status).toBe(200)
      expect((await support.get("/admin/products")).status).toBe(401)

      const entries = await audit().listAuditEntries({ resource_id: document.grant_id })
      expect(entries.map((entry) => entry.action).sort()).toEqual(
        ["support_access.ended", "support_access.refused", "support_access.started"].sort()
      )
    })

    it("refuses a forged, foreign, late or form-posted grant, and any while the switch is off", async () => {
      await createAdminUser(http, container())
      const late = grant({ issued_at: Math.floor(Date.now() / 1000) - 10 * 60 })
      expect(keyOf((await redeem(encode(late))).data)).toBe("support.grant_expired")
      const foreign = grant({ tenant_id: "ten_01JOTHERSHOP000000000000" })
      expect(keyOf((await redeem(encode(foreign))).data)).toBe("support.wrong_tenant")
      const tampered = JSON.parse(Buffer.from(encode(grant()), "base64url").toString()) as {
        document: SupportGrantDocument
      }
      tampered.document.reason = "Başka bir gerekçe yazıldı"
      const forged = await redeem(Buffer.from(JSON.stringify(tampered)).toString("base64url"))
      expect([forged.status, keyOf(forged.data)]).toEqual([401, "signature.invalid"])
      const form = await settle(
        http.post<Answer>(REDEEM, `grant=${encode(grant())}`, {
          headers: { "content-type": "application/x-www-form-urlencoded" },
        })
      )
      expect(form.status).toBe(415)

      await settings().saveSection("security", { support_access_enabled: false }, null)
      try {
        const off = await redeem(encode(grant()))
        expect([off.status, keyOf(off.data)]).toEqual([403, "support.disabled"])
      } finally {
        await settings().saveSection("security", { support_access_enabled: true }, null)
      }
    })

    it("ends open sessions when the owner turns the switch off or ends one", async () => {
      const owner = await createAdminUser(http, container())
      const a = as(sessionCookie(await redeem(encode(grant()))))
      const document = grant()
      const b = as(sessionCookie(await redeem(encode(document))))

      const end = await settle(
        http.post(
          `/admin/support-access/sessions/${document.grant_id}/end`,
          {},
          {
            headers: owner.headers,
          }
        )
      )
      expect(end.status).toBe(200)
      const ended = await b.get("/admin/products")
      expect([ended.status, keyOf(ended.data)]).toEqual([401, "support.session_ended"])

      expect((await a.get("/admin/products")).status).toBe(200)
      await settings().saveSection("security", { support_access_enabled: false }, null)
      try {
        const off = await a.get("/admin/products")
        expect([off.status, keyOf(off.data)]).toEqual([401, "support.session_ended"])
      } finally {
        await settings().saveSection("security", { support_access_enabled: true }, null)
      }
    })
  },
})
