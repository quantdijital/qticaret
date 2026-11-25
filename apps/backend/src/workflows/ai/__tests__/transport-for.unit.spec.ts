import { asValue } from "@medusajs/framework/awilix"
import { createMedusaContainer } from "@medusajs/framework/utils"
import { SIGNED_REQUEST_HEADERS } from "@qticaret/server-kit"
import type { AiCreditsStatus } from "@qticaret/types/control-plane"
import { isProviderError } from "../../../lib/errors/errors"
import { textConnectorWith } from "../../../lib/ai/connector-of"
import { platformServiceOf } from "../../../lib/ai/registry/platform-service"
import { aiServices } from "../../../lib/ai/registry/services"
import { findAiTask } from "../../../lib/ai/registry/tasks"
import { SEARCH_INTENT_TASK } from "../../../lib/ai/registry/search-tasks"
import { chooseService, usableServices } from "../../../lib/ai/select"
import * as credits from "../../../lib/control-plane/ai-credits"
import * as gatewayConfig from "../../../lib/control-plane/ai-gateway"
import { ENDPOINT, OPERATION, charged } from "../../../lib/ai/transport/__tests__/gateway-fake"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { AI_OWN_KEYS, AI_PLATFORM_CREDITS } from "../../../modules/platform-settings/features"
import { aiPlatformServiceOf, aiServicesFor } from "../connections"
import { transportFor } from "../transport-for"

/**
 * adr/0085 §3, K8–K10 (P4b-1): which service runs a staff member's task
 * and how its body travels. The shop's own key stays the default; the
 * platform's credits are "connected" only with the flag on and the
 * control plane saying so, run only priced tasks (never the storefront's
 * search), read no shop key and carry the run's operation.
 */

jest.mock("../../../lib/control-plane/ai-credits", () => ({
  aiCreditsStatus: jest.fn(),
  noteAiCharge: jest.fn(),
}))
jest.mock("../../../lib/control-plane/ai-gateway", () => ({
  ...jest.requireActual<object>("../../../lib/control-plane/ai-gateway"),
  aiGatewayEndpoint: jest.fn(),
}))

const ROUTED = { text: "deepseek", vision: "gemini", image_edit: "photoroom" }

const status = (services: Record<string, string> = ROUTED): AiCreditsStatus => ({
  available: true,
  balance: {
    plan: { remaining: 40, renews_on: "2026-12-01" },
    purchased: { remaining: 0, expires_on: null },
  },
  daily: { cap: 300, remaining: 300 },
  services,
  table: { seo_title: 1 },
  packs: [],
  pending_order: null,
})

const read = jest.fn()
function shop(flags: { ownKeys?: boolean; platformCredits?: boolean } = {}) {
  const made = createMedusaContainer()
  made.register({
    [INTEGRATION_CREDENTIALS_MODULE]: asValue({ read }),
    [PLATFORM_SETTINGS_MODULE]: asValue({
      isFeatureEnabled: (key: string) =>
        Promise.resolve(
          key === AI_OWN_KEYS
            ? (flags.ownKeys ?? true)
            : key === AI_PLATFORM_CREDITS && flags.platformCredits === true
        ),
    }),
  })
  return made
}

const SEO_TITLE = findAiTask("seo_title", "test")
const TEST_TEXT = findAiTask("test_text", "test")

beforeEach(() => {
  jest.mocked(credits.aiCreditsStatus).mockReset().mockResolvedValue(status())
  jest.mocked(gatewayConfig.aiGatewayEndpoint).mockReset().mockReturnValue(ENDPOINT)
  read.mockReset().mockResolvedValue({ secrets: { api_key: "test-only-key" } })
})

describe("the platform as a service", () => {
  it("takes each capability's target from the routed service, never the fake or an uncapped one", () => {
    const platform = platformServiceOf(ROUTED, "test")
    expect(platform?.funding).toBe("platform_credit")
    // Gemini's chat has no output cap: never routed on credits
    expect(Object.keys(platform?.capabilities ?? {}).sort()).toEqual(["image_edit", "text"])
    expect(platformServiceOf({ text: "fake" }, "test")).toBeNull()
    expect(platformServiceOf({ text: "nobody" }, "test")).toBeNull()
  })

  it("is connected only with the flag on, a control plane and its status saying so", async () => {
    expect(await aiPlatformServiceOf({ platformCredits: false })).toBeNull()
    expect(credits.aiCreditsStatus).not.toHaveBeenCalled()

    jest.mocked(gatewayConfig.aiGatewayEndpoint).mockReturnValue(null)
    expect(await aiPlatformServiceOf({ platformCredits: true })).toBeNull()
    expect(credits.aiCreditsStatus).not.toHaveBeenCalled()

    jest.mocked(gatewayConfig.aiGatewayEndpoint).mockReturnValue(ENDPOINT)
    jest.mocked(credits.aiCreditsStatus).mockResolvedValue({ available: false })
    expect(await aiPlatformServiceOf({ platformCredits: true })).toBeNull()

    jest.mocked(credits.aiCreditsStatus).mockResolvedValue(status())
    expect((await aiPlatformServiceOf({ platformCredits: true }))?.id).toBe("platform")
  })

  it("comes after the shop's own key, which stays the default (K8)", async () => {
    if (!SEO_TITLE || !TEST_TEXT) {
      throw new Error("no tasks")
    }
    const flags = { ownKeys: true, platformCredits: true }
    const services = await aiServicesFor(flags)
    const both = usableServices(
      SEO_TITLE,
      [{ provider: "deepseek", status: "connected" }],
      flags,
      services
    )
    expect(both.map((each) => each.id)).toEqual(["deepseek", "platform"])
    expect(chooseService({ task: SEO_TITLE, usable: both })).toMatchObject({
      ok: true,
      service: { id: "deepseek" },
      alternatives: ["platform"],
    })
    // Picked in the panel, or remembered: then the platform
    expect(chooseService({ task: SEO_TITLE, usable: both, requested: "platform" })).toMatchObject({
      service: { id: "platform" },
    })
    expect(chooseService({ task: SEO_TITLE, usable: both, preference: "platform" })).toMatchObject({
      service: { id: "platform" },
    })
    // No own key: the platform alone
    expect(usableServices(SEO_TITLE, [], flags, services).map((each) => each.id)).toEqual([
      "platform",
    ])
    // A task the credits do not sell, and the storefront's search: never (K10)
    expect(usableServices(TEST_TEXT, [], flags, services)).toEqual([])
    expect(usableServices(SEARCH_INTENT_TASK, [], flags, services)).toEqual([])
    expect(usableServices(SEARCH_INTENT_TASK, [], flags)).toEqual([])
    expect(await aiServicesFor({ ownKeys: true, platformCredits: false })).toEqual(aiServices())
  })
})

describe("transportFor", () => {
  it("reads the shop's key on its own service, as before", async () => {
    const route = await transportFor(shop(), {
      service: "deepseek",
      capability: "text",
      task: "seo_title",
      operation: OPERATION,
    })
    expect([route.service.id, route.transport.funding, route.transport.retries]).toEqual([
      "deepseek",
      "own_key",
      true,
    ])
    expect(read).toHaveBeenCalledWith("deepseek")
  })

  it("on the platform reads no key and signs the run's operation to the gateway", async () => {
    const sent: { url: string; init: RequestInit }[] = []
    const fetch = jest.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
      sent.push({ url: url instanceof Request ? url.url : url.toString(), init: init ?? {} })
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Keten Gömlek" }, finish_reason: "stop" }],
          }),
          { headers: { "content-type": "application/json", ...charged(1, 39) } }
        )
      )
    })
    try {
      const route = await transportFor(shop({ platformCredits: true }), {
        service: "platform",
        capability: "text",
        task: "seo_title",
        operation: OPERATION,
      })
      expect([route.service.id, route.transport.funding, route.transport.retries]).toEqual([
        "deepseek",
        "platform_credit",
        false,
      ])
      const connector = textConnectorWith(route.service.id, "text", route.transport, "test")
      await connector.complete({ system: "Görev.", data: "{}", maxTokens: 50 })
      await connector.complete({ system: "Düzelt.", data: "{}", maxTokens: 50 })
    } finally {
      fetch.mockRestore()
    }
    expect(read).not.toHaveBeenCalled()
    // Both calls of the run (a correction's too) carry the same operation
    expect(sent.map((each) => new URL(each.url).searchParams.get("operation"))).toEqual([
      OPERATION,
      OPERATION,
    ])
    const headers = sent[0]?.init.headers as Record<string, string>
    expect(Object.keys(headers)).toEqual(
      expect.arrayContaining(Object.values(SIGNED_REQUEST_HEADERS))
    )
    expect(Object.keys(headers).map((name) => name.toLowerCase())).not.toContain("authorization")
    expect(credits.noteAiCharge).toHaveBeenCalledWith({ credits: 1, balance: 39 })
  })

  it.each([
    ["a task the credits do not sell", { task: "search_intent" }, {}, "not_offered"],
    ["the flag off", {}, { platformCredits: false }, "flag_off"],
    ["no operation", { operation: null }, {}, "no_operation"],
    ["a capability the status routes nowhere", { capability: "vision" as const }, {}, "no_route"],
  ])("refuses the platform on %s", async (_case, change, flags, code) => {
    const error: unknown = await transportFor(shop({ platformCredits: true, ...flags }), {
      service: "platform",
      capability: "text",
      task: "seo_title",
      operation: OPERATION,
      ...change,
    }).catch((caught: unknown) => caught)
    expect(isProviderError(error) && [error.safeMessage, error.providerCode]).toEqual([
      "ai.platform_unavailable",
      code,
    ])
    expect(read).not.toHaveBeenCalled()
  })

  it("refuses the platform while its status says unavailable", async () => {
    jest.mocked(credits.aiCreditsStatus).mockResolvedValue({ available: false })
    const error: unknown = await transportFor(shop({ platformCredits: true }), {
      service: "platform",
      capability: "text",
      task: "seo_title",
      operation: OPERATION,
    }).catch((caught: unknown) => caught)
    expect(isProviderError(error) && error.providerCode).toBe("status_unavailable")
  })
})
