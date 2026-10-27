import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { anyOf, fakeGeliverToken, startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { createAdminUser } from "../helpers/admin"
import { captureOutput } from "../helpers/logs"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Account {
  provider: string
  state: string
  settings: Record<string, unknown> | null
  secrets: Record<string, boolean>
  secrets_version: number
}

const URL_PATH = "/admin/integrations/credentials/geliver"

/** F7 K1 (adr/0027, adr/0031): the shop connects its Geliver account from the panel. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let fake: FakeGeliver

    const post = (path: string, body: unknown) =>
      settle(
        http.post<{ account: Account; check: string | null }>(path, body, {
          headers: admin.headers,
        })
      )
    const account = () => ({ settings: { test_mode: true }, secrets: { api_token: fake.token } })

    beforeAll(async () => {
      fake = await startFakeGeliver()
      // Read on the first Geliver call (lib/shipping/geliver/client.ts)
      process.env["GELIVER_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["GELIVER_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      fake.requests.length = 0
    })

    it("connects after Geliver accepts the token; nothing shows it", async () => {
      let saved!: Awaited<ReturnType<typeof post>>
      let listed!: { data: unknown }
      const output = await captureOutput(async () => {
        saved = await post(URL_PATH, account())
        listed = await http.get("/admin/integrations/credentials", { headers: admin.headers })
      })

      expect(saved.status).toBe(200)
      expect(saved.data).toMatchObject({
        check: "valid",
        account: {
          provider: "geliver",
          state: "connected",
          settings: { test_mode: true },
          secrets: { api_token: true },
        },
      })
      expect(fake.requests).toHaveLength(1)
      expect(JSON.stringify([saved.data, listed.data])).not.toMatch(anyOf(fake.token))
      expect(output).not.toMatch(anyOf(fake.token))
    })

    it("refuses a token Geliver turns down, naming the field, and stores nothing", async () => {
      const refused = await post(URL_PATH, {
        settings: { test_mode: true },
        secrets: { api_token: fakeGeliverToken() },
      })
      const { data } = await http.get<{ accounts: Account[] }>("/admin/integrations/credentials", {
        headers: admin.headers,
      })

      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ message: "geliver.secret_invalid" })
      expect(data.accounts.find(({ provider }) => provider === "geliver")?.state).toBe(
        "not_configured"
      )
    })

    it("leaves test mode with the same token, tests it and reports it in the integration health", async () => {
      await post(URL_PATH, account())

      const live = await post(URL_PATH, { settings: { test_mode: false } })
      const tested = await post(`${URL_PATH}/check`, {})
      const { data } = await http.get<{ checks: { id: string; status: string; kind: string }[] }>(
        "/admin/integrations/health",
        { headers: admin.headers }
      )

      expect(live.data).toMatchObject({
        account: { state: "connected", settings: { test_mode: false }, secrets_version: 1 },
      })
      expect(tested.data).toMatchObject({ check: "valid", account: { state: "connected" } })
      expect(data.checks).toContainEqual(
        expect.objectContaining({ id: "geliver", kind: "shipping", status: "ok" })
      )
    })

    it("disconnects: the token is gone", async () => {
      await post(URL_PATH, account())

      const removed = await settle(
        http.delete<{ account: Account }>(URL_PATH, { headers: admin.headers })
      )

      expect(removed.data.account).toMatchObject({ state: "not_configured", settings: null })
    })
  },
})
