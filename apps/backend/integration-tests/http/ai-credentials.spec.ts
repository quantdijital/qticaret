import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { PlanLimits } from "@qticaret/types/control-plane"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { AI_OWN_KEYS } from "../../src/modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import { doc, managedForThisFile, signed } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { captureOutput } from "../helpers/logs"
import { nextSerial } from "../helpers/plan-limits"

jest.setTimeout(120 * 1000)

interface Account {
  provider: string
  state: string
  settings: Record<string, unknown> | null
  secrets: Record<string, boolean>
}

interface Answer {
  account?: Account
  accounts?: Account[]
  check?: string | null
  message?: string
}

const URL_PATH = "/admin/integrations/credentials"

/**
 * adr/0071 §3, §6 (PR 0b-2): the shop connects an AI service with its own
 * key, through the same credential routes as any provider. Every call here
 * stays on the machine: connecting and testing go to the fake AI service,
 * and the real services are only ever refused before anyone is asked.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    // Plainly fake, fresh per run (docs/04)
    const key = `test-key-${fakeSecret()}`

    managedForThisFile()

    const flags = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    // The flag reaches the shop only through the push route (its workflow syncs the flags)
    const pushFlag = async (on: boolean) => {
      const pushed = await settle(
        http.post(
          "/hooks/control-plane/plan",
          signed(
            doc(nextSerial(), {
              limits: Object.fromEntries(LIMIT_KEYS.map((name) => [name, null])) as PlanLimits,
              platform_flags: { [AI_OWN_KEYS]: on },
            })
          )
        )
      )
      expect(pushed.status).toBe(200)
      expect(await flags().isFeatureEnabled(AI_OWN_KEYS)).toBe(on)
    }
    const post = (path: string, body: unknown, headers = owner.headers) =>
      settle(http.post<Answer>(`${URL_PATH}/${path}`, body, { headers }))
    const accountOf = async (provider: string) =>
      (await http.get<Answer>(URL_PATH, { headers: owner.headers })).data.accounts?.find(
        (account) => account.provider === provider
      )
    const connectFake = () => post("fake", { settings: {}, secrets: { api_key: key } })

    beforeEach(async () => {
      await pushFlag(true)
      owner = await createAdminUser(http, getContainer())
    })

    it("connects a service with its key alone; no answer or log holds the key", async () => {
      let saved!: Awaited<ReturnType<typeof post>>
      let checked!: Awaited<ReturnType<typeof post>>
      let listed!: { data: unknown }
      const output = await captureOutput(async () => {
        saved = await connectFake()
        checked = await post("fake/check", {})
        listed = await http.get(URL_PATH, { headers: owner.headers })
      })

      expect(saved.status).toBe(200)
      expect(saved.data).toMatchObject({
        check: "valid",
        account: { provider: "fake", state: "connected", settings: {}, secrets: { api_key: true } },
      })
      expect(checked.data).toMatchObject({ check: "valid", account: { state: "connected" } })
      expect(JSON.stringify([saved.data, checked.data, listed.data])).not.toContain(key)
      expect(output).not.toContain(key)
    })

    it("takes no address, region or model beside the key, and asks nobody", async () => {
      for (const settings of [{ base_url: "https://attacker.invalid/v1" }, { region: "cn" }]) {
        const refused = await post("deepseek", { settings, secrets: { api_key: key } })
        expect(refused.status).toBe(400)
      }
      const short = await post("gemini", { settings: {}, secrets: { api_key: "short" } })

      expect(short.status).toBe(400)
      expect(await accountOf("deepseek")).toMatchObject({ state: "not_configured" })
    })

    it("leaves keys to the owner: an admin may test, operations and readonly neither", async () => {
      await connectFake()
      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const body = { settings: {}, secrets: { api_key: `test-key-${fakeSecret()}` } }

      expect((await post("deepseek", body, admin.headers)).status).toBe(403)
      expect((await post("fake", body, admin.headers)).status).toBe(403)
      expect(
        (await settle(http.delete(`${URL_PATH}/fake`, { headers: admin.headers }))).status
      ).toBe(403)
      expect((await post("fake/check", {}, admin.headers)).data).toMatchObject({ check: "valid" })
      for (const member of [operations, readonly]) {
        expect((await post("fake/check", {}, member.headers)).status).toBe(403)
        expect((await post("fake", body, member.headers)).status).toBe(403)
      }
      expect(await accountOf("fake")).toMatchObject({ state: "connected" })
    })

    it("refuses connecting and testing while the package has no own keys; the key stays", async () => {
      await connectFake()
      await pushFlag(false)

      const replaced = await post("fake", { settings: {}, secrets: { api_key: key } })
      const real = await post("deepseek", { settings: {}, secrets: { api_key: key } })
      const checked = await post("fake/check", {})

      for (const refused of [replaced, real, checked]) {
        expect([refused.status, refused.data.message]).toEqual([403, "ai.own_keys_not_in_plan"])
      }
      expect(await accountOf("fake")).toMatchObject({
        state: "connected",
        secrets: { api_key: true },
      })
      expect(await accountOf("deepseek")).toMatchObject({ state: "not_configured" })

      // Other providers are no business of this flag
      const paytr = await post("paytr", {
        settings: { merchant_id: "abc", test_mode: true },
        secrets: { merchant_key: fakeSecret(), merchant_salt: fakeSecret() },
      })
      expect(paytr.data.message).not.toBe("ai.own_keys_not_in_plan")

      // A package that allows it again finds the stored key as it was
      await pushFlag(true)
      expect((await post("fake/check", {})).data).toMatchObject({
        check: "valid",
        account: { state: "connected" },
      })
    })

    it("disconnects while the package has no own keys", async () => {
      await connectFake()
      await pushFlag(false)

      const removed = await settle(
        http.delete<Answer>(`${URL_PATH}/fake`, { headers: owner.headers })
      )

      expect(removed.status).toBe(200)
      expect(removed.data.account).toMatchObject({ state: "not_configured" })
    })
  },
})
