import { isProviderError } from "../../../errors/errors"
import { textConnectorWith } from "../../connector-of"
import { sendByRules } from "../../connectors/send-rules"
import type { Judged } from "../../connectors/send-rules"
import { findAiService } from "../../registry/services"
import type { AiErrorKey } from "../../errors"
import { platformTransport } from "../platform"
import type { AiTransport, AiTransportResponse } from "../types"
import { ENDPOINT, TERMS, charged, gateway, hanging, now } from "./gateway-fake"

/**
 * The platform's transport under the connectors' sending rules (adr/0085
 * §3, P4a review D1–D3): a deadline is a timeout, nothing is sent twice,
 * the four terms are held to the contract before anything is signed, each
 * answer carries its own charge, and the shop's own-account words never
 * reach a shop paying with credits.
 */

const DEEPSEEK = findAiService("deepseek", "test")
const MINIMAX = findAiService("minimax", "test")

function to() {
  const target = DEEPSEEK?.capabilities.text
  if (!DEEPSEEK || target?.connector !== "openai-compatible") {
    throw new Error("no text target")
  }
  return { service: DEEPSEEK, target, url: new URL(`${target.baseUrl}${target.path}`) }
}

const transportOn = (fetch: (url: string, init: RequestInit) => Promise<Response>) =>
  platformTransport({ ...TERMS, endpoint: ENDPOINT, fetch, now })

async function thrown(run: Promise<unknown>) {
  const error: unknown = await run.then(
    () => null,
    (caught: unknown) => caught
  )
  if (!isProviderError(error)) {
    throw new Error("expected a provider error")
  }
  return error
}

const failing =
  (key: AiErrorKey, retry: boolean) =>
  (response: AiTransportResponse): Judged<string> => ({
    ok: false,
    failure: { service: "deepseek", key, code: `http_${String(response.status)}`, retry },
  })

const send = (
  transport: AiTransport,
  judge: (response: AiTransportResponse) => Judged<string>,
  overrides: { timeoutMs?: number; signal?: AbortSignal } = {}
) =>
  sendByRules({
    transport,
    to: to(),
    body: "{}",
    headers: { "content-type": "application/json" },
    timeoutMs: overrides.timeoutMs ?? 1_000,
    maxResponseBytes: 64 * 1024,
    signal: overrides.signal,
    wait: () => Promise.resolve(),
    judge,
  })

describe("platform transport under the sending rules", () => {
  it("reads the call's own deadline as a timeout, the caller letting go as an abort (D1)", async () => {
    const late = await thrown(
      send(transportOn(hanging), failing("ai.timeout", false), { timeoutMs: 20 })
    )
    expect([late.safeMessage, late.providerCode]).toEqual(["ai.timeout", "timeout"])

    const controller = new AbortController()
    const run = send(transportOn(hanging), failing("ai.timeout", false), {
      signal: controller.signal,
    })
    controller.abort()
    const gone = await thrown(run)
    expect([gone.safeMessage, gone.providerCode]).toEqual(["ai.timeout", "aborted"])
  })

  it("never sends the operation's body again after a 5xx or a 429", async () => {
    for (const status of [503, 429]) {
      const { fetch, received } = gateway(
        () => new Response("{}", { status, headers: charged(0, 9) })
      )
      const error = await thrown(send(transportOn(fetch), failing("ai.provider_busy", true)))
      expect(received).toHaveLength(1)
      expect(error.safeMessage).toBe("ai.provider_busy")
    }
  })

  it.each(["ai.key_rejected", "ai.provider_balance", "ai.provider_quota"] as const)(
    "tells a shop on credits %s as platform unavailable, keeping the code",
    async (key) => {
      const { fetch } = gateway(() => new Response("{}", { status: 402, headers: charged(0, 9) }))
      const error = await thrown(send(transportOn(fetch), failing(key, false)))
      expect([error.safeMessage, error.providerCode]).toEqual([
        "ai.platform_unavailable",
        "http_402",
      ])
    }
  )

  it("tells a shop on its own key what its service said", async () => {
    const own: AiTransport = {
      funding: "own_key",
      retries: false,
      send: () => Promise.resolve({ status: 402, headers: {}, body: Buffer.alloc(0) }),
    }
    const error = await thrown(send(own, failing("ai.provider_balance", false)))
    expect(error.safeMessage).toBe("ai.provider_balance")
  })
})

describe("a connector on the platform's credits: the provider's own-account answers", () => {
  const ask = (serviceId: string, answer: () => Response) =>
    textConnectorWith(
      serviceId,
      "text",
      platformTransport({
        ...TERMS,
        service: serviceId,
        endpoint: ENDPOINT,
        fetch: gateway(answer).fetch,
        now,
      }),
      "test"
    ).complete({ system: "Görev.", data: "{}", maxTokens: 50 })

  it('a provider\'s 402 is not "your service has no balance"', async () => {
    const error = await thrown(
      ask(
        "deepseek",
        () => new Response('{"error":{"code":402}}', { status: 402, headers: charged(0, 9) })
      )
    )
    expect(error.safeMessage).toBe("ai.platform_unavailable")
  })

  it.each([
    [1004, "key"],
    [1008, "balance"],
  ])("MiniMax's body code %i (%s) is not the shop's account either", async (code) => {
    expect(MINIMAX?.bodyErrors?.[code]).toBeDefined()
    const body = JSON.stringify({ base_resp: { status_code: code } })
    const error = await thrown(
      ask("minimax", () => new Response(body, { status: 200, headers: charged(0, 9) }))
    )
    expect(error.safeMessage).toBe("ai.platform_unavailable")
  })
})

describe("platform transport: its terms and its charges", () => {
  it.each([
    ["an operation not a uuid", { operation: "op-1" }],
    ["a task not of its shape", { task: "SEO Title" }],
    ["a capability not of its shape", { capability: "Text&x=1" }],
    ["a service not of its shape", { service: "deep seek" }],
  ])("refuses %s before anything is signed (D2)", (_case, change) => {
    const { fetch, received } = gateway(() => new Response("{}"))
    let error: unknown = null
    try {
      platformTransport({ ...TERMS, ...change, endpoint: ENDPOINT, fetch, now })
    } catch (caught) {
      error = caught
    }
    expect(isProviderError(error) && [error.safeMessage, error.providerCode]).toEqual([
      "ai.platform_unavailable",
      "call_terms_invalid",
    ])
    expect(received).toHaveLength(0)
  })

  it("gives each answer its own charge, two at once on one transport (D3)", async () => {
    let calls = 0
    const told: unknown[] = []
    const { fetch } = gateway(() => {
      calls += 1
      const credits = calls
      return new Promise((resolve) =>
        setTimeout(
          () => {
            resolve(new Response("{}", { headers: charged(credits, 50 - credits) }))
          },
          5 * (3 - credits)
        )
      )
    })
    const transport = platformTransport({
      ...TERMS,
      endpoint: ENDPOINT,
      fetch,
      now,
      onCharge: (charge) => told.push(charge),
    })
    const request = {
      to: to(),
      method: "POST" as const,
      body: "{}",
      headers: {},
      timeoutMs: 1_000,
      maxResponseBytes: 1024,
      signal: new AbortController().signal,
    }
    const [first, second] = await Promise.all([transport.send(request), transport.send(request)])
    expect([first.charge, second.charge]).toEqual([
      { credits: 1, balance: 49 },
      { credits: 2, balance: 48 },
    ])
    expect(told).toHaveLength(2)
  })

  it.each([
    ["negative", "-1"],
    ["longer than ten digits", "12345678901"],
  ])("does not believe a charge header %s: platform unavailable", async (_case, value) => {
    const { fetch } = gateway(
      () => new Response("{}", { headers: { ...charged(1, 2), "x-qt-ai-credits-charged": value } })
    )
    const error = await thrown(
      transportOn(fetch).send({
        to: to(),
        method: "POST",
        body: "{}",
        headers: {},
        timeoutMs: 1_000,
        maxResponseBytes: 1024,
        signal: new AbortController().signal,
      })
    )
    expect([error.safeMessage, error.providerCode]).toEqual([
      "ai.platform_unavailable",
      "gateway_http_200",
    ])
  })
})
