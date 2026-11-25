import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import type { AiGatewayRefusalCode } from "@qticaret/types/control-plane"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import { forgetProcessCaches } from "../../src/lib/cache/process-caches"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import {
  AI_ASSISTANT,
  AI_PLATFORM_CREDITS,
  AI_STOREFRONT_SEARCH,
} from "../../src/modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan } from "../helpers/ai"
import {
  GATED_TITLE,
  availableStatus,
  chatAnswer,
  fakeAiGateway,
  refusalAnswer,
  toolCallAnswer,
} from "../helpers/ai-gateway"
import { listen, managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * adr/0085 §3, K8–K10 (P4b-1): the platform's credits against a stand-in
 * gateway. Off, nothing is asked of the control plane; on, the shop's own
 * key stays the default; with no key a priced task goes signed to the
 * gateway, with its four values in the query and no provider credential,
 * taking the day's place but not the month's; the gateway's refusals
 * reach the panel as their own keys; an assistant turn's calls share one
 * operation; the storefront's search never goes there.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const gateway = fakeAiGateway()
    let owner: { headers: Record<string, string> }

    managedForThisFile()

    beforeAll(async () => {
      process.env["CONTROL_PLANE_URL"] = await listen(gateway.server)
    })

    afterAll(() => {
      gateway.server.close()
    })

    beforeEach(async () => {
      forgetProcessCaches()
      resetAiBreakers()
      gateway.calls.length = 0
      gateway.state.answers = []
      gateway.state.statusAsks = 0
      gateway.state.status = availableStatus()
      owner = await createAdminUser(http, getContainer())
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const credits = (on: boolean) => pushPlan(http, true, {}, { [AI_PLATFORM_CREDITS]: on })
    // The shop's own (fake) service answers a title the SEO gate takes, as the gateway does
    const ownAnswersTitle = () =>
      jest.spyOn(fakeTextConnector, "complete").mockResolvedValue({
        text: GATED_TITLE,
        usage: { inputTokens: 10, outputTokens: 10 },
      })
    const seoTitle = async () => ({
      task: "seo_title",
      entity_type: "product",
      entity_id: await aiProduct(getContainer()),
    })

    it("asks nothing of the control plane while the flag is off", async () => {
      await credits(false)
      const none = await ask(owner.headers, await seoTitle())
      expect([none.status, none.data.message]).toEqual([400, "ai.no_service"])

      await connectFake(http, owner.headers, key)
      ownAnswersTitle()
      const own = await ask(owner.headers, await seoTitle())
      expect(own.status).toBe(201)
      expect(own.data.suggestion).toMatchObject({ service: "fake", alternatives: [] })
      expect([gateway.state.statusAsks, gateway.calls.length]).toEqual([0, 0])
    })

    it("keeps the shop's own key as the default, offering the platform beside it", async () => {
      await credits(true)
      await connectFake(http, owner.headers, key)
      ownAnswersTitle()
      const own = await ask(owner.headers, await seoTitle())
      expect(own.status).toBe(201)
      expect(own.data.suggestion).toMatchObject({ service: "fake", alternatives: ["platform"] })
      expect(gateway.calls).toHaveLength(0)
    })

    it("sends a priced task signed to the gateway when the shop has no key", async () => {
      await credits(true)
      const asked = await ask(owner.headers, await seoTitle())

      expect(asked.status).toBe(201)
      expect(asked.data.suggestion).toMatchObject({ service: "platform" })
      expect(gateway.calls.length).toBeGreaterThanOrEqual(1)
      const [call] = gateway.calls
      expect(call?.signed).toBe(true)
      expect([...(call?.query.keys() ?? [])]).toEqual([
        "task",
        "capability",
        "service",
        "operation",
      ])
      expect(call?.query.get("task")).toBe("seo_title")
      expect(call?.query.get("capability")).toBe("text")
      expect(call?.query.get("service")).toBe("deepseek")
      expect(call?.query.get("operation")).toMatch(UUID)
      // A correction, if one was made, rides on the same operation
      expect(new Set(gateway.calls.map((each) => each.query.get("operation"))).size).toBe(1)
      for (const name of ["authorization", "x-api-key", "x-goog-api-key"]) {
        expect(call?.headers[name]).toBeUndefined()
      }
      expect(JSON.stringify(call?.headers)).not.toContain(key)
      // adr/0085 K9: the day's place is taken, the month's operation is not
      expect(await records().monthly()).toBe(0)
      expect(await records().today()).toBe(1)
    })

    it.each([
      ["credits_exhausted", "ai.credits_exhausted"],
      ["daily_cap", "ai.credits_daily_cap"],
      ["busy", "ai.platform_busy"],
      ["unavailable", "ai.platform_unavailable"],
    ] as [AiGatewayRefusalCode, string][])(
      "tells the gateway's %s as %s and gives the day back",
      async (code, message) => {
        await credits(true)
        gateway.state.answers = [refusalAnswer(code)]
        const refused = await ask(owner.headers, await seoTitle())

        expect(refused.data).toMatchObject({ message, provider: "platform" })
        expect(gateway.calls).toHaveLength(1)
        expect(await records().monthly()).toBe(0)
        expect(await records().today()).toBe(0)
      }
    )

    it("never tells a shop on credits that its own service has no balance", async () => {
      await credits(true)
      gateway.state.answers = [
        {
          status: 402,
          headers: { "x-qt-ai-credits-charged": "0", "x-qt-ai-credits-balance": "40" },
          body: '{"error":{"code":402}}',
        },
      ]
      const refused = await ask(owner.headers, await seoTitle())
      expect(refused.data.message).toBe("ai.platform_unavailable")
    })

    it("carries one operation through an assistant turn's calls", async () => {
      await credits(true)
      await settings().setFeature(AI_ASSISTANT, true, null)
      gateway.state.answers = [
        toolCallAnswer("find_screen", { query: "kargo ücreti" }),
        chatAnswer("Kargo ücretleri burada: [[settings.shipping.options]]", 0),
      ]
      const turn = await settle(
        http.post<{ message?: string }>(
          "/admin/ai/assistant/turns",
          { message: "kargo ücreti nereden değişir" },
          { headers: owner.headers }
        )
      )

      expect(turn.status).toBe(200)
      expect(gateway.calls).toHaveLength(2)
      const operations = gateway.calls.map((each) => each.query.get("operation"))
      expect(operations[0]).toMatch(UUID)
      expect(operations[1]).toBe(operations[0])
      expect(gateway.calls.map((each) => each.query.get("task"))).toEqual([
        "assistant",
        "assistant",
      ])
      expect(await records().monthly()).toBe(0)
    })

    it("never sends the storefront's search to the platform", async () => {
      await credits(true)
      await settings().setFeature(AI_STOREFRONT_SEARCH, true, null)
      const store = await createStorefront(getContainer())
      const answer = await settle(
        http.post<{ fallback?: boolean }>(
          "/store/search/interpret",
          { text: "Kapadokya balon turu" },
          { headers: store.headers }
        )
      )
      expect(answer.status).toBe(200)
      expect(answer.data.fallback).toBe(true)
      expect(gateway.calls).toHaveLength(0)
    })

    it("counts the platform as not connected while its status says unavailable", async () => {
      await credits(true)
      gateway.state.status = { available: false }
      const none = await ask(owner.headers, await seoTitle())
      expect([none.status, none.data.message]).toEqual([400, "ai.no_service"])
      expect(gateway.state.statusAsks).toBeGreaterThanOrEqual(1)
      expect(gateway.calls).toHaveLength(0)
    })
  },
})
