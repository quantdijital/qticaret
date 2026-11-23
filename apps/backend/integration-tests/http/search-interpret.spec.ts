import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import { aiProviderError } from "../../src/lib/ai/errors"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { AI_STOREFRONT_SEARCH } from "../../src/modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import { aiRecords, connectFake, pushPlan, storedRunsWith } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Interpretation {
  query: string
  understood: { kind: string; label: string }[]
  dropped: unknown[]
  fallback?: boolean
}

/**
 * adr/0077 §7: `POST /store/search/interpret` end to end on the fake
 * service, which answers the sentence itself as `q`. No such route while
 * the shop's flag is off; with it on and no key, the sentence is searched
 * as it is; with the fake connected, the call is recorded under `vitrin`
 * and neither the usage row nor a workflow run holds the sentence.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    // Plainly fake, fresh per run (docs/04)
    const key = `test-key-${fakeSecret()}`
    let store: Storefront
    let owner: { headers: Record<string, string> }
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const interpret = (text: string) =>
      settle(
        http.post<Interpretation>("/store/search/interpret", { text }, { headers: store.headers })
      )

    managedForThisFile()

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    afterEach(() => {
      jest.restoreAllMocks()
      Reflect.deleteProperty(process.env, "AI_STORE_SEARCH_DAILY_LIMIT")
    })

    it("does not exist while the shop's flag is off", async () => {
      const answer = await interpret("Kapadokya balon turu")
      expect(answer.status).toBe(404)
    })

    it("searches the sentence as it is while no key is connected", async () => {
      await settings().setFeature(AI_STOREFRONT_SEARCH, true, null)
      const answer = await interpret("Pamukkale travertenleri")
      expect(answer.status).toBe(200)
      expect(answer.data).toEqual({
        query: "q=Pamukkale+travertenleri",
        understood: [],
        dropped: [],
        fallback: true,
      })
      expect(await aiRecords(getContainer()).usages()).toEqual([])
      expect(await storedRunsWith(getContainer(), "travertenleri")).toBe(0)
    })

    it("searches the sentence as it is at the day's ceiling, calling nothing and keeping no text", async () => {
      await settings().setFeature(AI_STOREFRONT_SEARCH, true, null)
      await connectFake(http, owner.headers, key)
      process.env["AI_STORE_SEARCH_DAILY_LIMIT"] = "0"
      const complete = jest.spyOn(fakeTextConnector, "complete")
      const answer = await interpret("Efes antik kenti")
      expect(answer.data).toMatchObject({ query: "q=Efes+antik+kenti", fallback: true })
      expect(complete).not.toHaveBeenCalled()
      expect(await aiRecords(getContainer()).usages()).toEqual([])
      expect(await storedRunsWith(getContainer(), "antik kenti")).toBe(0)
    })

    it("searches the sentence as it is when the service fails, recording the call without it", async () => {
      await settings().setFeature(AI_STOREFRONT_SEARCH, true, null)
      await connectFake(http, owner.headers, key)
      jest
        .spyOn(fakeTextConnector, "complete")
        .mockRejectedValue(
          aiProviderError({ service: "fake", key: "ai.provider_busy", code: "http_429" })
        )
      const answer = await interpret("Nemrut dağı gün doğumu")
      expect(answer.data).toMatchObject({
        query: "q=Nemrut+da%C4%9F%C4%B1+g%C3%BCn+do%C4%9Fumu",
        fallback: true,
      })
      const usages = await aiRecords(getContainer()).usages()
      expect(usages.map((each) => [each.status, each.error_code, each.requested_by])).toEqual([
        ["failed", "http_429", "vitrin"],
      ])
      expect(JSON.stringify(usages)).not.toMatch(/Nemrut/)
      expect(await storedRunsWith(getContainer(), "Nemrut")).toBe(0)
    })

    it("reads the sentence on the shop's key, once a day, keeping no text", async () => {
      await settings().setFeature(AI_STOREFRONT_SEARCH, true, null)
      await connectFake(http, owner.headers, key)
      const text = "Kapadokya balon 0532 123 45 67"
      const first = await interpret(text)
      const again = await interpret(`  ${text.toLowerCase()} `)
      expect(first.status).toBe(200)
      expect(first.data).toEqual({
        query: "q=kapadokya+balon",
        understood: [{ kind: "q", label: "kapadokya balon", param: "q", value: "kapadokya balon" }],
        dropped: [],
      })
      expect(again.data).toEqual(first.data)
      const usages = await aiRecords(getContainer()).usages()
      expect(usages).toHaveLength(1)
      expect(usages[0]).toMatchObject({
        task: "search_intent",
        service: "fake",
        status: "succeeded",
        requested_by: "vitrin",
        entity_id: null,
      })
      expect(JSON.stringify(usages)).not.toMatch(/apadokya|0532/)
      expect(await storedRunsWith(getContainer(), "0532")).toBe(0)
      expect(await storedRunsWith(getContainer(), "Kapadokya balon")).toBe(0)
    })

    it("refuses an empty or too long sentence", async () => {
      await settings().setFeature(AI_STOREFRONT_SEARCH, true, null)
      expect((await interpret("   ")).status).toBe(400)
      expect((await interpret("a".repeat(201))).status).toBe(400)
    })
  },
})
