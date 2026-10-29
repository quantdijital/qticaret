import { createApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { anyOf, fakePaytrAccount, fakeSecret, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../src/modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../src/modules/integration-credentials/service"
import { createAdminUser } from "../helpers/admin"
import { captureOutput } from "../helpers/logs"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()
const newSalt = fakeSecret()
const SECRETS = anyOf(account.merchantKey, account.merchantSalt, newSalt)

interface Account {
  provider: string
  state: string
  settings: Record<string, unknown> | null
  secrets: Record<string, boolean>
  secrets_version: number
}

interface AuditEntry {
  action: string
  changes: { fields?: string[]; diff?: Record<string, unknown> } | null
}

const URL_PATH = "/admin/integrations/credentials"
const paytrOf = (accounts: Account[]) => accounts.find(({ provider }) => provider === "paytr")
const connect = {
  settings: { merchant_id: "100001", test_mode: true },
  secrets: { merchant_key: account.merchantKey, merchant_salt: account.merchantSalt },
}

/** F5 V1 (adr/0027): the shop connects its PayTR account from the panel. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let fake: FakePaytr

    const post = (path: string, body: unknown) =>
      settle(
        http.post<{ account: Account; check: string | null }>(path, body, {
          headers: admin.headers,
        })
      )
    const checks = () => fake.requests.filter((request) => request.path === "/odeme/durum-sorgu")

    beforeAll(async () => {
      fake = await startFakePaytr(account)
      // Read on the first PayTR call (lib/payments/paytr/client.ts)
      process.env["PAYTR_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["PAYTR_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      fake.requests.length = 0
    })

    it("lists every provider as not connected, with the server's key in place", async () => {
      const { data } = await http.get<{ key_configured: boolean; accounts: Account[] }>(URL_PATH, {
        headers: admin.headers,
      })

      expect(data.key_configured).toBe(true)
      expect(data.accounts).toEqual([
        expect.objectContaining({
          provider: "paytr",
          state: "not_configured",
          secrets: { merchant_key: false, merchant_salt: false },
        }),
        expect.objectContaining({
          provider: "iyzico",
          state: "not_configured",
          secrets: { api_key: false, secret_key: false },
        }),
        expect.objectContaining({
          provider: "geliver",
          state: "not_configured",
          secrets: { api_token: false },
        }),
        expect.objectContaining({
          provider: "aras",
          state: "not_configured",
          secrets: { username: false, password: false },
        }),
        expect.objectContaining({
          provider: "yurtici",
          state: "not_configured",
          secrets: { username: false, password: false, cod_username: false, cod_password: false },
        }),
        expect.objectContaining({
          provider: "netgsm",
          state: "not_configured",
          secrets: { usercode: false, password: false },
        }),
        // F10 M13: connected through Google's consent screen, never typed
        expect.objectContaining({
          provider: "google",
          state: "not_configured",
          secrets: { refresh_token: false },
        }),
      ])
    })

    it("refuses details PayTR turns down, naming the field, and stores nothing", async () => {
      const wrongNumber = await post(`${URL_PATH}/paytr`, {
        ...connect,
        settings: { ...connect.settings, merchant_id: "999999" },
      })
      const wrongSalt = await post(`${URL_PATH}/paytr`, {
        ...connect,
        secrets: { ...connect.secrets, merchant_salt: fakeSecret() },
      })
      const { data } = await http.get<{ accounts: Account[] }>(URL_PATH, { headers: admin.headers })

      expect(wrongNumber.status).toBe(400)
      expect(wrongNumber.data).toMatchObject({ message: "paytr.merchant_invalid" })
      expect(wrongSalt.status).toBe(400)
      expect(wrongSalt.data).toMatchObject({ message: "paytr.secret_invalid" })
      expect(paytrOf(data.accounts)?.state).toBe("not_configured")
    })

    it("connects after PayTR accepts; no answer, log or audit record holds a secret", async () => {
      let saved!: Awaited<ReturnType<typeof post>>
      let listed!: { data: unknown }
      // A refused save logs the provider's answer too: none of it may quote a secret
      const output = await captureOutput(async () => {
        await post(`${URL_PATH}/paytr`, {
          ...connect,
          secrets: { ...connect.secrets, merchant_salt: newSalt },
        })
        saved = await post(`${URL_PATH}/paytr`, connect)
        listed = await http.get<{ accounts: Account[] }>(URL_PATH, { headers: admin.headers })
      })

      expect(saved.status).toBe(200)
      expect(saved.data).toMatchObject({
        check: "valid",
        account: {
          state: "connected",
          settings: connect.settings,
          secrets: { merchant_key: true, merchant_salt: true },
          secrets_version: 1,
        },
      })
      expect(checks()).toHaveLength(2)
      expect(JSON.stringify([saved.data, listed.data, fake.requests])).not.toMatch(SECRETS)
      expect(output).toContain("http_client.request")
      expect(output).not.toMatch(SECRETS)

      let entries: AuditEntry[] = []
      for (let attempt = 0; attempt < 30 && entries.length === 0; attempt++) {
        entries = (
          await http.get<{ audit_entries: AuditEntry[] }>(
            "/admin/audit-log?resource_id=paytr&kind=mutation",
            { headers: admin.headers }
          )
        ).data.audit_entries
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(entries[0]).toMatchObject({
        action: "POST /admin/integrations/credentials/:provider",
        changes: {
          diff: expect.objectContaining({
            state: { before: "not_configured", after: "connected" },
            secrets_version: { before: 0, after: 1 },
          }) as unknown,
        },
      })
      expect(JSON.stringify(entries)).not.toMatch(SECRETS)
    })

    it("changes test mode without asking PayTR; a new secret is checked again", async () => {
      await post(`${URL_PATH}/paytr`, connect)
      fake.requests.length = 0

      const testMode = await post(`${URL_PATH}/paytr`, {
        settings: { ...connect.settings, test_mode: false },
      })

      expect(testMode.data).toMatchObject({ check: null, account: { state: "connected" } })
      expect(checks()).toHaveLength(0)

      const changed = await post(`${URL_PATH}/paytr`, {
        settings: connect.settings,
        secrets: { merchant_salt: newSalt },
      })

      // The fake knows the old salt only: PayTR would refuse the new one
      expect(changed.status).toBe(400)
      expect(changed.data).toMatchObject({ message: "paytr.secret_invalid" })
    })

    it("asks for both secrets when the shop number changes", async () => {
      await post(`${URL_PATH}/paytr`, connect)

      const moved = await post(`${URL_PATH}/paytr`, {
        settings: { ...connect.settings, merchant_id: "100002" },
        secrets: { merchant_key: account.merchantKey },
      })

      expect(moved.status).toBe(400)
      expect(moved.data).toMatchObject({ message: "integration_credentials.secrets_required" })
    })

    it("saves as unchecked when PayTR cannot be reached, and checks again on request", async () => {
      fake.queue("/odeme/durum-sorgu", { drop: true })
      fake.queue("/odeme/durum-sorgu", { drop: true })
      fake.queue("/odeme/durum-sorgu", { drop: true })

      const saved = await post(`${URL_PATH}/paytr`, connect)
      const checked = await post(`${URL_PATH}/paytr/check`, {})

      expect(saved.data).toMatchObject({ check: "unreachable", account: { state: "unverified" } })
      expect(checked.data).toMatchObject({ check: "valid", account: { state: "connected" } })
    })

    it("keeps a working account when PayTR cannot be reached to check new details", async () => {
      await post(`${URL_PATH}/paytr`, connect)
      for (let attempt = 0; attempt < 3; attempt++) {
        fake.queue("/odeme/durum-sorgu", { drop: true })
      }

      const replaced = await post(`${URL_PATH}/paytr`, {
        settings: connect.settings,
        secrets: { merchant_salt: fakeSecret() },
      })
      const { data } = await http.get<{ accounts: Account[] }>(URL_PATH, { headers: admin.headers })

      expect(replaced.status).toBe(400)
      expect(replaced.data).toMatchObject({
        message: "integration_credentials.provider_unreachable",
      })
      expect(paytrOf(data.accounts)).toMatchObject({ state: "connected", secrets_version: 1 })
    })

    it("tests the stored account: unreachable changes nothing, refused details show", async () => {
      await post(`${URL_PATH}/paytr`, connect)
      for (let attempt = 0; attempt < 3; attempt++) {
        fake.queue("/odeme/durum-sorgu", { drop: true })
      }
      const unreachable = await post(`${URL_PATH}/paytr/check`, {})

      expect(unreachable.data).toMatchObject({
        check: "unreachable",
        account: { state: "connected" },
      })

      // Details PayTR stopped accepting (a salt renewed in PayTR's panel, say)
      const service = getContainer().resolve<IntegrationCredentialsModuleService>(
        INTEGRATION_CREDENTIALS_MODULE
      )
      const stale = await service.draft("paytr", {
        settings: connect.settings,
        secrets: { merchant_salt: fakeSecret() },
      })
      await service.store(stale, "verified", null)
      const refused = await post(`${URL_PATH}/paytr/check`, {})

      expect(refused.data).toMatchObject({
        check: "secret_invalid",
        account: { state: "rejected" },
      })
    })

    it("tells every admin in the bell who changed the payment account and how", async () => {
      await post(`${URL_PATH}/paytr`, connect)
      await post(`${URL_PATH}/paytr`, { settings: { ...connect.settings, test_mode: false } })
      await settle(http.delete(`${URL_PATH}/paytr`, { headers: admin.headers }))

      const { data } = await http.get<{
        notifications: { data: Record<string, unknown> }[]
      }>("/admin/notifications?fields=data,created_at&order=created_at", { headers: admin.headers })
      const alerts = data.notifications
        .map((notification) => notification.data)
        .filter((alert) => alert["kind"] === "provider_account")

      expect(alerts.map((alert) => alert["changes"])).toEqual(
        expect.arrayContaining([["connected"], ["test_mode_off"], ["removed"]])
      )
      expect(alerts[0]).toMatchObject({
        provider: "paytr",
        actor: expect.stringMatching(/@example\.com$/) as string,
      })
      expect(JSON.stringify(alerts)).not.toMatch(SECRETS)
    })

    it("reports PayTR in the integration health with the stored account", async () => {
      await post(`${URL_PATH}/paytr`, connect)

      const { data } = await http.get<{ checks: { id: string; status: string }[] }>(
        "/admin/integrations/health",
        { headers: admin.headers }
      )

      expect(data.checks).toContainEqual(expect.objectContaining({ id: "paytr", status: "ok" }))
    })

    it("disconnects: the account is gone and a test says so", async () => {
      await post(`${URL_PATH}/paytr`, connect)

      const removed = await settle(
        http.delete<{ account: Account }>(`${URL_PATH}/paytr`, { headers: admin.headers })
      )
      const checked = await post(`${URL_PATH}/paytr/check`, {})

      expect(removed.data.account).toMatchObject({ state: "not_configured", settings: null })
      expect(checked.data).toMatchObject({ check: "not_configured" })
    })

    it("refuses an unknown provider, a malformed body and an integration key", async () => {
      const { result } = await createApiKeysWorkflow(getContainer()).run({
        input: { api_keys: [{ title: "integration", type: "secret", created_by: "user_test" }] },
      })
      const basic = Buffer.from(`${result[0]?.token ?? ""}:`).toString("base64")

      const health = await settle(
        http.get("/admin/integrations/health", { headers: { authorization: `Basic ${basic}` } })
      )
      const checkBody = await post(`${URL_PATH}/paytr/check`, { force: true })
      const unknown = await post(`${URL_PATH}/stripe`, connect)
      const extra = await post(`${URL_PATH}/paytr`, { ...connect, provider: "x" })
      const byKey = await settle(
        http.post(`${URL_PATH}/paytr`, connect, { headers: { authorization: `Basic ${basic}` } })
      )

      expect(unknown.status).toBe(404)
      expect(extra.status).toBe(400)
      expect(byKey.status).toBe(403)
      expect(health.status).toBe(403)
      expect(checkBody.status).toBe(400)
    })
  },
})
