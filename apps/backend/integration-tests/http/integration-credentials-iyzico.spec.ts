import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { anyOf, fakeIyzicoAccount, fakeSecret, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import { createAdminUser } from "../helpers/admin"
import { captureOutput } from "../helpers/logs"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// A made-up sandbox account, fresh per run; the fake server checks every signature with it
const keys = fakeIyzicoAccount()
const SECRETS = anyOf(keys.apiKey, keys.secretKey)

interface Account {
  provider: string
  state: string
  settings: Record<string, unknown> | null
  secrets: Record<string, boolean>
  secrets_version: number
}

const URL_PATH = "/admin/integrations/credentials/iyzico"
const INSTALLMENT = "/payment/iyzipos/installment"
const sandbox = {
  settings: { test_mode: true },
  secrets: { api_key: keys.apiKey, secret_key: keys.secretKey },
}

/** F5 V8 (adr/0027): the shop connects its iyzico account from the panel, sandbox first. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let fake: FakeIyzico

    const post = (path: string, body: unknown) =>
      settle(
        http.post<{ account: Account; check: string | null }>(path, body, {
          headers: admin.headers,
        })
      )
    const checks = () => fake.requests.filter((request) => request.path === INSTALLMENT)

    beforeAll(async () => {
      fake = await startFakeIyzico(keys)
      // Read on the first iyzico call (lib/payments/iyzico/client.ts), for both modes
      process.env["IYZICO_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["IYZICO_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      fake.requests.length = 0
    })

    it("connects the sandbox after iyzico accepts the keys; nothing shows them", async () => {
      let saved!: Awaited<ReturnType<typeof post>>
      let listed!: { data: unknown }
      const output = await captureOutput(async () => {
        saved = await post(URL_PATH, sandbox)
        listed = await http.get("/admin/integrations/credentials", { headers: admin.headers })
      })

      expect(saved.status).toBe(200)
      expect(saved.data).toMatchObject({
        check: "valid",
        account: {
          provider: "iyzico",
          state: "connected",
          settings: { test_mode: true },
          secrets: { api_key: true, secret_key: true },
        },
      })
      expect(checks()).toHaveLength(1)
      expect(JSON.stringify([saved.data, listed.data])).not.toMatch(SECRETS)
      expect(output).not.toMatch(SECRETS)
    })

    it("refuses keys iyzico turns down, naming the field, and stores nothing", async () => {
      const unknownKey = await post(URL_PATH, {
        ...sandbox,
        secrets: { ...sandbox.secrets, api_key: `sandbox-${fakeSecret()}` },
      })
      const wrongSecret = await post(URL_PATH, {
        ...sandbox,
        secrets: { ...sandbox.secrets, secret_key: fakeSecret() },
      })
      const { data } = await http.get<{ accounts: Account[] }>("/admin/integrations/credentials", {
        headers: admin.headers,
      })

      expect(unknownKey.status).toBe(400)
      expect(unknownKey.data).toMatchObject({ message: "iyzico.merchant_invalid" })
      expect(wrongSecret.status).toBe(400)
      expect(wrongSecret.data).toMatchObject({ message: "iyzico.secret_invalid" })
      expect(data.accounts.find(({ provider }) => provider === "iyzico")?.state).toBe(
        "not_configured"
      )
    })

    it("asks for both keys again to leave the sandbox, and checks the new ones", async () => {
      await post(URL_PATH, sandbox)

      const keptKeys = await post(URL_PATH, { settings: { test_mode: false } })
      fake.requests.length = 0
      const live = await post(URL_PATH, { ...sandbox, settings: { test_mode: false } })

      expect(keptKeys.status).toBe(400)
      expect(keptKeys.data).toMatchObject({ message: "integration_credentials.secrets_required" })
      expect(live.data).toMatchObject({
        check: "valid",
        account: { state: "connected", settings: { test_mode: false }, secrets_version: 2 },
      })
      expect(checks()).toHaveLength(1)
    })

    it("tests the stored account and reports it in the integration health", async () => {
      await post(URL_PATH, sandbox)

      const tested = await post(`${URL_PATH}/check`, {})
      const { data } = await http.get<{ checks: { id: string; status: string }[] }>(
        "/admin/integrations/health",
        { headers: admin.headers }
      )

      expect(tested.data).toMatchObject({ check: "valid", account: { state: "connected" } })
      expect(data.checks).toContainEqual(expect.objectContaining({ id: "iyzico", status: "ok" }))
    })

    it("disconnects: the keys are gone", async () => {
      await post(URL_PATH, sandbox)

      const removed = await settle(
        http.delete<{ account: Account }>(URL_PATH, { headers: admin.headers })
      )

      expect(removed.data.account).toMatchObject({ state: "not_configured", settings: null })
    })
  },
})
