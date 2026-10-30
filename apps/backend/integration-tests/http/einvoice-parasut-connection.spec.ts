import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeParasut } from "@qticaret/testing"
import type { FakeParasut } from "@qticaret/testing"
import { EINVOICE_MODULE } from "../../src/modules/einvoice"
import type EinvoiceModuleService from "../../src/modules/einvoice/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

const ENV = ["PARASUT_CLIENT_ID", "PARASUT_CLIENT_SECRET", "PARASUT_BASE_URL"] as const

interface Parasut {
  available: boolean
  authorize_url: string | null
  connection: { company_id: string; status: string; last_error: string | null } | null
}

/** F8 E2 (adr/0034 §5): the owner connects the shop's Paraşüt company with a pasted code. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    // Random each run: no client secret or password is ever written into a test
    const client = { clientId: "test-platform", clientSecret: randomBytes(16).toString("hex") }
    const user = { username: "test@example.com", password: randomBytes(16).toString("hex") }
    let parasut: FakeParasut

    beforeAll(async () => {
      parasut = await startFakeParasut(client, user)
      Object.assign(process.env, {
        PARASUT_CLIENT_ID: client.clientId,
        PARASUT_CLIENT_SECRET: client.clientSecret,
        PARASUT_BASE_URL: parasut.url,
      })
    })

    afterAll(async () => {
      for (const name of ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await parasut.close()
    })

    it("connects with a pasted code, checks it, refreshes a dead token, and forgets it", async () => {
      const owner = await createAdminUser(http, getContainer())
      const admin = await createAdminUser(http, getContainer(), "admin")
      const connect = (headers: Record<string, string>, body: unknown) =>
        settle(
          http.post<{ parasut: Parasut; message?: string }>("/admin/einvoice/parasut", body, {
            headers,
          })
        )
      const check = async () =>
        (
          await http.post<{ check: { ok: boolean; code: string | null } }>(
            "/admin/einvoice/parasut/check",
            {},
            { headers: admin.headers }
          )
        ).data.check

      const before = await http.get<{ parasut: Parasut }>("/admin/einvoice/parasut", {
        headers: owner.headers,
      })
      const byAdmin = await connect(admin.headers, {
        company_id: parasut.companyId,
        code: parasut.issueCode(),
      })
      const withoutProof = await connect(owner.plain, {
        company_id: parasut.companyId,
        code: parasut.issueCode(),
      })
      const otherCompany = await connect(owner.headers, {
        company_id: "999",
        code: parasut.issueCode(),
      })
      const code = parasut.issueCode()
      const connected = await connect(owner.headers, { company_id: parasut.companyId, code })
      const spent = await connect(owner.headers, { company_id: parasut.companyId, code })
      const fresh = await check()
      parasut.expireTokens()
      const refreshed = await check()
      const stored = await getContainer()
        .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
        .listParasutConnections({})
      const removed = await settle(
        http.delete<{ parasut: Parasut }>("/admin/einvoice/parasut", { headers: owner.headers })
      )

      expect(before.data.parasut).toMatchObject({ available: true, connection: null })
      expect(before.data.parasut.authorize_url).toContain(
        `${parasut.url}/oauth/authorize?client_id=test-platform`
      )
      expect(byAdmin.status).toBe(403)
      expect(withoutProof.status).toBe(428)
      expect(otherCompany.data.message).toBe("einvoice.parasut_company_refused")
      expect(connected.status).toBe(200)
      expect(connected.data.parasut.connection).toMatchObject({
        company_id: parasut.companyId,
        status: "connected",
      })
      expect(spent.data.message).toBe("einvoice.parasut_code_refused")
      expect(fresh).toEqual({ ok: true, code: null })
      expect(refreshed).toEqual({ ok: true, code: null })
      expect(JSON.stringify(stored)).not.toMatch(/erisim-|yenileme-/)
      expect(removed.data.parasut.connection).toBeNull()
    })

    it("says the connection broke when Paraşüt refuses its refresh token", async () => {
      const owner = await createAdminUser(http, getContainer())
      await http.post(
        "/admin/einvoice/parasut",
        { company_id: parasut.companyId, code: parasut.issueCode() },
        { headers: owner.headers }
      )
      parasut.revokeTokens()

      const check = await http.post<{ check: { ok: boolean; code: string | null } }>(
        "/admin/einvoice/parasut/check",
        {},
        { headers: owner.headers }
      )
      const status = await http.get<{ parasut: Parasut }>("/admin/einvoice/parasut", {
        headers: owner.headers,
      })

      expect(check.data.check).toEqual({ ok: false, code: "einvoice.parasut_disconnected" })
      expect(status.data.parasut.connection).toMatchObject({
        status: "broken",
        last_error: "invalid_grant",
      })
    })
  },
})
