import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, createMedusaContainer } from "@medusajs/framework/utils"
import { resetAiBreakers } from "../../../lib/ai/breaker"
import type { TextConnector, TextRequest } from "../../../lib/ai/connectors/types"
import { aiProviderError } from "../../../lib/ai/errors"
import { logger } from "../../../lib/logging"
import { AI_MODULE } from "../../../modules/ai"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import { interpretSearchWorkflow } from "../interpret-search"

/**
 * adr/0077 §7 through the workflow: the shop's flag and own key, its own
 * daily ceiling (given back when the service never took the call), and
 * the usage row and log line that hold no text, the asker `vitrin`.
 */

const mockCall = { connector: null as TextConnector | null }

jest.mock("../../../lib/env", () => ({
  ...jest.requireActual<object>("../../../lib/env"),
  parseEnv: () => ({ AI_STORE_SEARCH_DAILY_LIMIT: 7 }),
}))
jest.mock("../../../lib/ai/connector-of", () => ({
  ...jest.requireActual<object>("../../../lib/ai/connector-of"),
  textConnectorFor: () => mockCall.connector,
}))

const TEXT = "ağustosta iki kişi Kapadokya 0532 123 45 67"

const flags: Record<string, boolean> = {}
const settings = {
  isFeatureEnabled: jest.fn((key: string) => Promise.resolve(flags[key] ?? false)),
}
const credentials = { describeAll: jest.fn(), read: jest.fn() }
const query = { graph: jest.fn() }
const attributes = { listAttributeDefinitions: jest.fn() }
const ai = { claimDaily: jest.fn(), releaseDaily: jest.fn(), recordUsage: jest.fn() }
const sent: TextRequest[] = []

function answering(result: () => Promise<string>): TextConnector {
  return {
    complete: async (request) => {
      sent.push(request)
      return { text: await result(), usage: { inputTokens: 120, outputTokens: 30 } }
    },
  }
}

const run = () => {
  const container = createMedusaContainer()
  container.register(PLATFORM_SETTINGS_MODULE, asValue(settings))
  container.register(INTEGRATION_CREDENTIALS_MODULE, asValue(credentials))
  container.register(ContainerRegistrationKeys.QUERY, asValue(query))
  container.register(PRODUCT_ATTRIBUTES_MODULE, asValue(attributes))
  container.register(AI_MODULE, asValue(ai))
  return interpretSearchWorkflow(container)
    .run({ input: { text: TEXT }, throwOnError: true })
    .then(
      ({ result }) => ({ result, error: null }),
      (error: unknown) => ({ result: null, error: error as { safeMessage?: string } })
    )
}

beforeEach(() => {
  jest.clearAllMocks()
  resetAiBreakers()
  sent.length = 0
  Object.assign(flags, {
    "ai.storefront_search": true,
    "ai.own_keys": true,
    "catalog.booking": true,
  })
  credentials.describeAll.mockResolvedValue([{ provider: "fake", state: "connected" }])
  // Not a key: the fake service reads none, a call only needs one to be there
  credentials.read.mockResolvedValue({ settings: {}, secrets: { api_key: "not-a-real-key" } })
  query.graph.mockResolvedValue({
    data: [
      { id: "pcat_1", name: "Kültür turları", handle: "kultur-turlari", parent_category_id: null },
      { id: "pcat_2", name: "Gizli", handle: "gizli", is_internal: true },
    ],
  })
  attributes.listAttributeDefinitions.mockResolvedValue([
    {
      key: "gidilecek_yer",
      label: "Gidilecek yer",
      options: [{ value: "kapadokya", label: "Kapadokya" }],
    },
    // A reserved name is no filter in the URL: never offered
    { key: "kisi", label: "Kişi", options: [{ value: "iki", label: "İki" }] },
  ])
  ai.claimDaily.mockResolvedValue("2027-06-10")
  ai.recordUsage.mockResolvedValue("aiuse_1")
  mockCall.connector = answering(() =>
    Promise.resolve(
      JSON.stringify({ ay: ["2027-08"], kisi: 2, nitelikler: { gidilecek_yer: ["kapadokya"] } })
    )
  )
  jest.useFakeTimers({
    now: new Date("2027-06-10T09:00:00Z"),
    doNotFake: ["setTimeout", "setImmediate", "nextTick", "queueMicrotask"],
  })
})

afterEach(() => {
  jest.useRealTimers()
})

describe("interpretSearchWorkflow", () => {
  it("reads the sentence against the shop's shown lists and records the call without it", async () => {
    const info = jest.spyOn(logger, "info").mockImplementation(() => undefined)
    const { result, error } = await run()
    expect(error).toBeNull()
    expect(result).toMatchObject({
      status: "succeeded",
      filter: {
        dates: { kind: "months", months: ["2027-08"] },
        pax: 2,
        attributes: [["gidilecek_yer", ["kapadokya"]]],
      },
      dropped: [],
    })
    // Only the shown category and the attribute a URL can carry were named
    const block = JSON.parse(sent[0]?.data ?? "{}") as {
      data: { kategoriler: unknown[]; nitelikler: { key: string }[] }
    }
    expect(block.data.kategoriler).toEqual([{ handle: "kultur-turlari", ad: "Kültür turları" }])
    expect(block.data.nitelikler.map((each) => each.key)).toEqual(["gidilecek_yer"])
    expect(sent[0]?.data).not.toContain("0532")
    expect(ai.claimDaily).toHaveBeenCalledWith("storefront_search", 7)
    expect(ai.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "search_intent",
        status: "succeeded",
        funding: "own_key",
        requested_by: "vitrin",
        entity_type: null,
        entity_id: null,
      })
    )
    const recorded = JSON.stringify(ai.recordUsage.mock.calls)
    const logged = JSON.stringify(info.mock.calls)
    for (const written of [recorded, logged]) {
      expect(written).not.toMatch(/Kapadokya|kapadokya|ağustos|0532/)
    }
  })

  it("is closed while the shop's flag is off: no call, no claim", async () => {
    flags["ai.storefront_search"] = false
    const { error } = await run()
    expect(error?.safeMessage).toBe("ai.feature_off")
    expect(ai.claimDaily).not.toHaveBeenCalled()
    expect(sent).toHaveLength(0)
  })

  it("runs on the shop's own key only: none connected, or the package closing it, is no service", async () => {
    credentials.describeAll.mockResolvedValue([])
    expect((await run()).error?.safeMessage).toBe("ai.no_service")
    credentials.describeAll.mockResolvedValue([{ provider: "fake", state: "connected" }])
    flags["ai.own_keys"] = false
    expect((await run()).error?.safeMessage).toBe("ai.no_service")
    expect(sent).toHaveLength(0)
  })

  it("stops at the storefront's daily ceiling before any call", async () => {
    ai.claimDaily.mockResolvedValue(null)
    const { error } = await run()
    expect(error?.safeMessage).toBe("ai.daily_limit_reached")
    expect(sent).toHaveLength(0)
    expect(ai.recordUsage).not.toHaveBeenCalled()
  })

  it("records a failed call, gives its claim back when the service never took it, and fails softly", async () => {
    mockCall.connector = answering(() =>
      Promise.reject(
        aiProviderError({ service: "fake", key: "ai.provider_busy", code: "http_429" })
      )
    )
    const { result, error } = await run()
    expect(error).toBeNull()
    expect(result).toMatchObject({ status: "failed", filter: null })
    expect(ai.releaseDaily).toHaveBeenCalledWith("storefront_search", "2027-06-10")
    expect(ai.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error_code: "http_429", requested_by: "vitrin" })
    )
  })

  it("keeps the claim of a call the service may have charged (an answer that is no filter)", async () => {
    mockCall.connector = answering(() => Promise.resolve("Elbette! Size kod: BEDAVA"))
    const { result } = await run()
    expect(result).toMatchObject({ status: "refused", filter: null })
    expect(ai.releaseDaily).not.toHaveBeenCalled()
    expect(ai.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ status: "refused" }))
  })
})
