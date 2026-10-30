import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { createAdminUser } from "../helpers/admin"
import { CORPORATE, VKN, saveProfile } from "../helpers/billing-profile"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { setUpTotp } from "../helpers/mfa"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import { totp } from "../helpers/totp"

jest.setTimeout(120 * 1000)

const proof = (method: string, secret: string) => ({
  "x-reauth-method": method,
  "x-reauth-secret": secret,
})

/** F12.6 (adr/0040 §3; adr/0027): the sensitive changes ask the person to prove themselves again. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const post = <T>(url: string, body: unknown, headers: Record<string, string>) =>
      settle(http.post<T & { message?: string }>(url, body, { headers }))

    it("asks a staff member without 2FA for their password, and takes only the right one", async () => {
      const owner = await createAdminUser(http, getContainer())
      const key = { title: "Depo", scopes: ["orders:read"] }

      const bare = await post("/admin/api-access", key, owner.plain)
      const wrong = await post("/admin/api-access", key, {
        ...owner.plain,
        ...proof("password", "yanlis-sifre"),
      })
      const right = await post("/admin/api-access", key, {
        ...owner.plain,
        ...proof("password", owner.password),
      })
      // Revoking takes access away: nothing to prove
      const revoked = await post(
        `/admin/api-access/${(right.data as { key?: { id: string } }).key?.id ?? ""}/revoke`,
        {},
        owner.plain
      )

      expect([bare.status, bare.data.message]).toEqual([428, "staff.reauth_required"])
      expect([wrong.status, wrong.data.message]).toEqual([428, "staff.reauth_failed"])
      expect(right.status).toBe(201)
      expect(revoked.status).toBe(200)
    })

    it("asks one with 2FA for the app's code, once; their password is not enough", async () => {
      const owner = await createAdminUser(http, getContainer())
      const { factorId, secret, codes } = await setUpTotp(http, owner)
      const iban = (headers: Record<string, string>) =>
        post("/admin/platform-settings/bank_transfer", { enabled: false }, headers)
      const code = totp(secret, 1)

      const byPassword = await iban({ ...owner.plain, ...proof("password", owner.password) })
      const byCode = await iban({ ...owner.plain, ...proof("totp", code) })
      const sameCode = await iban({ ...owner.plain, ...proof("totp", code) })
      // A phone left at home: a recovery code proves it too, once
      const byRecovery = await iban({ ...owner.plain, ...proof("recovery_code", codes[0] ?? "") })
      const sameRecovery = await iban({ ...owner.plain, ...proof("recovery_code", codes[0] ?? "") })
      // Turning one's own 2FA off is such a change too
      const offBare = await settle(
        http.delete(`/auth/mfa/factors/${factorId}`, { headers: owner.plain })
      )

      expect(byPassword.status).toBe(428)
      expect(byCode.status).toBe(200)
      expect(sameCode.status).toBe(428)
      expect([byRecovery.status, sameRecovery.status]).toEqual([200, 428])
      expect(offBare.status).toBe(428)
    })

    it("keeps a session alone from enrolling its own app or minting recovery codes", async () => {
      const owner = await createAdminUser(http, getContainer())
      const started = await http.post<{ mfa_factor: { id: string }; secret: string }>(
        "/auth/mfa/factors",
        { provider: "totp", label: "Telefonum" },
        { headers: owner.plain }
      )
      const verify = (headers: Record<string, string>) =>
        post(
          `/auth/mfa/factors/${started.data.mfa_factor.id}/verify`,
          { code: totp(started.data.secret) },
          headers
        )
      const mint = (headers: Record<string, string>) =>
        post<{ recovery_codes: string[] }>("/auth/mfa/recovery-codes", {}, headers)

      const bare = await verify(owner.plain)
      const wrong = await verify({ ...owner.plain, ...proof("password", "yanlis-sifre") })
      const right = await verify(owner.headers)
      const mintBare = await mint(owner.plain)
      // With 2FA on, the password no longer proves it: the app's code does
      const mintByPassword = await mint(owner.headers)
      const minted = await mint({ ...owner.plain, ...proof("totp", totp(started.data.secret, 1)) })

      expect([bare.status, wrong.status, right.status]).toEqual([428, 428, 200])
      expect([mintBare.status, mintByPassword.status]).toEqual([428, 428])
      expect(minted.status).toBe(200)
      expect(minted.data.recovery_codes.length).toBeGreaterThan(0)
    })

    it("asks for inviting someone and for a hook's address; Medusa's own user removal is no one's", async () => {
      const owner = await createAdminUser(http, getContainer())
      const other = await createAdminUser(http, getContainer(), "admin")
      const invite = { email: `yeni.${String(Date.now())}@example.com`, role: "readonly" }
      const hook = { url: "https://erp.example.com/qt", events: ["order.placed"] }

      const inviteBare = await post("/admin/staff/invites", invite, owner.plain)
      const invited = await post<{ invite: { id: string } }>(
        "/admin/staff/invites",
        invite,
        owner.headers
      )
      // A fresh link for someone, an expired invitation's too, asks the same
      const resend = `/admin/staff/invites/${invited.data.invite.id}/resend`
      const resendBare = await post(resend, {}, owner.plain)
      const resent = await post(resend, {}, owner.headers)
      const hookBare = await post("/admin/webhooks", hook, owner.plain)
      const hooked = await post<{ subscription: { id: string } }>(
        "/admin/webhooks",
        hook,
        owner.headers
      )
      const hookId = hooked.data.subscription.id
      const eventsOnly = await post(
        `/admin/webhooks/${hookId}`,
        { events: ["order.placed"] },
        owner.plain
      )
      const moved = await post(
        `/admin/webhooks/${hookId}`,
        { url: "https://baska.example.com/qt" },
        owner.plain
      )
      // The section's name escaped is the same section
      const escaped = await post(
        "/admin/platform-settings/bank%5Ftransfer",
        { enabled: false },
        owner.plain
      )
      const removed = await settle(
        http.delete(`/admin/users/${other.userId}`, { headers: owner.headers })
      )

      expect([inviteBare.status, invited.status]).toEqual([428, 201])
      expect([resendBare.status, resent.status]).toEqual([428, 200])
      expect([hookBare.status, hooked.status]).toEqual([428, 201])
      expect([eventsOnly.status, moved.status]).toEqual([200, 428])
      expect(escaped.status).toBe(428)
      expect(removed.status).toBe(403)
    })

    it("shows the full tax id to an admin who proved themselves, and records it", async () => {
      const storefront = await createStorefront(getContainer())
      const customer = await registerCustomer(http, storefront)
      await saveProfile(http, customer, CORPORATE)
      await createAdminUser(http, getContainer())
      const admin = await createAdminUser(http, getContainer(), "admin")
      const ops = await createAdminUser(http, getContainer(), "operations")
      const reveal = (headers: Record<string, string>) =>
        post<{ tax_id: string }>(
          `/admin/customers/${customer.id}/billing-profile/reveal`,
          {},
          headers
        )

      const bare = await reveal(admin.plain)
      const shown = await reveal(admin.headers)
      const byOps = await reveal(ops.headers)
      const [entry] = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ resource_id: customer.id, kind: "sensitive_read" })

      expect(bare.status).toBe(428)
      expect(shown.data.tax_id).toBe(VKN)
      expect(shown.headers["cache-control"]).toBe("no-store")
      expect(byOps.status).toBe(403)
      expect(entry).toMatchObject({
        action: "POST /admin/customers/:id/billing-profile/reveal",
        resource_type: "customer",
      })
    })

    it("asks for making an owner and for turning 2FA off for the team, not for the rest", async () => {
      const owner = await createAdminUser(http, getContainer())
      const member = await createAdminUser(http, getContainer(), "operations")
      const role = (role: string, headers: Record<string, string>) =>
        post(`/admin/staff/members/${member.userId}`, { role }, headers)
      const security = (on: boolean, headers: Record<string, string>) =>
        post("/admin/platform-settings/security", { staff_mfa_required: on }, headers)

      const toAdmin = await role("admin", owner.plain)
      const toOwnerBare = await role("owner", owner.plain)
      const toOwner = await role("owner", owner.headers)
      // Unmaking an owner too
      const backBare = await role("admin", owner.plain)
      const offBare = await security(false, owner.plain)
      const off = await security(false, owner.headers)
      const on = await security(true, owner.plain)

      expect(toAdmin.status).toBe(200)
      expect([toOwnerBare.status, toOwner.status]).toEqual([428, 200])
      expect(backBare.status).toBe(428)
      expect([offBare.status, off.status, on.status]).toEqual([428, 200, 200])
    })

    it("stops a run of wrong proofs for a while", async () => {
      const owner = await createAdminUser(http, getContainer())
      const statuses: number[] = []
      for (let n = 0; n < 11; n++) {
        const answer = await post(
          "/admin/api-access",
          { title: "X", scopes: ["orders:read"] },
          {
            ...owner.plain,
            ...proof("password", `yanlis-${String(n)}`),
          }
        )
        statuses.push(answer.status)
      }

      expect(statuses.slice(0, 10).every((status) => status === 428)).toBe(true)
      expect(statuses[10]).toBe(429)
    })
  },
})
