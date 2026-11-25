import { SIGNED_REQUEST_HEADERS } from "@qticaret/server-kit"
import { AI_CREDITS_PATHS } from "@qticaret/types/control-plane"
import { isProviderError } from "../../../errors/errors"
import { aiCallPath, aiGatewayEndpoint } from "../../../control-plane/ai-gateway"
import { findAiService } from "../../registry/services"
import type { AiService, OpenAiCompatibleTarget } from "../../registry/services"
import { AI_GATEWAY_MAX_BODY_BYTES, isAiGatewayRefusal, platformTransport } from "../platform"
import type { AiTransportRequest } from "../types"
import {
  ENDPOINT,
  OPERATION,
  TERMS,
  bytesOf,
  charged,
  gateway,
  hanging,
  now,
  refusal,
  signedBy,
} from "./gateway-fake"

/** adr/0085 §3 (P4a): the platform's transport against a stand-in gateway. */

function deepseek(): { service: AiService; target: OpenAiCompatibleTarget } {
  const service = findAiService("deepseek", "test")
  const target = service?.capabilities.text
  if (!service || target?.connector !== "openai-compatible") {
    throw new Error("no text target")
  }
  return { service, target }
}

const BODY = '{"model":"deepseek-flash","messages":[{"role":"user","content":"Keten Gömlek"}]}'

function request(overrides: Partial<AiTransportRequest> = {}): AiTransportRequest {
  return {
    to: { ...deepseek(), url: new URL("https://api.deepseek.com/chat/completions") },
    method: "POST",
    body: BODY,
    headers: {
      Authorization: "Bearer test-key-must-not-leave",
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Custom": "dropped",
    },
    timeoutMs: 1_000,
    maxResponseBytes: 64 * 1024,
    signal: new AbortController().signal,
    ...overrides,
  }
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

const PATH = `${AI_CREDITS_PATHS.calls}?task=seo_title&capability=text&service=deepseek&operation=${OPERATION}`

describe("platform transport: the request", () => {
  it("puts the four terms in the signed query, in order", () => {
    expect(aiCallPath(TERMS)).toBe(PATH)
  })

  it("posts the body's bytes signed, with only its type and accept, no credential", async () => {
    const { fetch, received } = gateway(
      () => new Response("{}", { status: 200, headers: charged(1, 99) })
    )
    await transportOn(fetch).send(request())
    const [sent] = received
    if (sent === undefined) {
      throw new Error("nothing was sent")
    }
    expect(sent.url).toBe(`${ENDPOINT.url}${PATH}`)
    expect(sent.init).toMatchObject({ method: "POST", redirect: "error" })
    expect(bytesOf(sent.init.body).equals(Buffer.from(BODY))).toBe(true)
    const headers = sent.init.headers as Record<string, string>
    expect(Object.keys(headers).sort()).toEqual(
      ["accept", "content-type", ...Object.values(SIGNED_REQUEST_HEADERS)].sort()
    )
    expect(headers["content-type"]).toBe("application/json")
    expect(JSON.stringify(sent)).not.toContain("test-key-must-not-leave")
    await expect(signedBy(sent, PATH)).resolves.toBe(true)
    // The terms are signed: the same headers do not hold for another task
    await expect(signedBy(sent, PATH.replace("seo_title", "image_scene"))).resolves.toBe(false)
  })

  it("posts a multipart body as its very bytes", async () => {
    const multipart = Buffer.concat([
      Buffer.from('--b\r\nContent-Disposition: form-data; name="f"\r\n\r\n'),
      Buffer.from([0, 255, 137, 80, 78, 71, 13, 10]),
      Buffer.from("\r\n--b--\r\n"),
    ])
    const { fetch, received } = gateway(
      () => new Response(Buffer.from([1, 2]), { status: 200, headers: charged(10, 5) })
    )
    await transportOn(fetch).send(
      request({ body: multipart, headers: { "Content-Type": "multipart/form-data; boundary=b" } })
    )
    const [sent] = received
    if (sent === undefined) {
      throw new Error("nothing was sent")
    }
    expect(bytesOf(sent.init.body).equals(multipart)).toBe(true)
    expect((sent.init.headers as Record<string, string>)["content-type"]).toBe(
      "multipart/form-data; boundary=b"
    )
    await expect(signedBy(sent, PATH)).resolves.toBe(true)
  })

  it("never sends a body over the gateway's cap, nor one built for another service", async () => {
    const { fetch, received } = gateway(() => new Response("{}"))
    const big = await thrown(
      transportOn(fetch).send(request({ body: Buffer.alloc(AI_GATEWAY_MAX_BODY_BYTES + 1) }))
    )
    expect([big.safeMessage, big.providerCode]).toEqual(["ai.input_unsupported", "body_too_large"])
    const gemini = findAiService("gemini", "test")
    if (gemini === null) {
      throw new Error("no gemini")
    }
    const other = await thrown(
      transportOn(fetch).send(
        request({
          to: { ...deepseek(), service: gemini, url: new URL("https://x.invalid/") },
        })
      )
    )
    expect([other.safeMessage, other.providerCode]).toEqual([
      "ai.platform_unavailable",
      "service_mismatch",
    ])
    expect(received).toHaveLength(0)
  })

  it("cannot be made on a shop without a control plane", () => {
    expect(aiGatewayEndpoint({})).toBeNull()
    let error: unknown = null
    try {
      platformTransport({ ...TERMS, endpoint: null })
    } catch (caught) {
      error = caught
    }
    expect(isProviderError(error) && error.safeMessage).toBe("ai.platform_unavailable")
  })

  it("never lets the connector send twice", () => {
    const transport = transportOn(gateway(() => new Response("{}")).fetch)
    expect([transport.funding, transport.retries]).toEqual(["platform_credit", false])
  })
})

describe("platform transport: a provider's answer", () => {
  it.each([200, 400, 429, 503])(
    "passes %i back as it came and reads the charge",
    async (status) => {
      const { fetch } = gateway(
        () =>
          new Response("provider said this", {
            status,
            headers: {
              ...charged(status === 200 ? 2 : 0, 41),
              "content-type": "text/plain",
              "retry-after": "9",
            },
          })
      )
      const transport = transportOn(fetch)
      expect(transport.lastCharge()).toBeNull()
      const answer = await transport.send(request())
      expect(answer).toEqual({
        status,
        headers: { "content-type": "text/plain" },
        body: Buffer.from("provider said this"),
      })
      expect(transport.lastCharge()).toEqual({ credits: status === 200 ? 2 : 0, balance: 41 })
    }
  )
})

describe("platform transport: when the gateway is not the one answering", () => {
  it.each([
    ["the control plane refused the signature", 401, {}],
    ["the control plane forbade it", 403, charged(0, 1)],
    ["the control plane failed", 500, {}],
    ["no such route yet", 404, {}],
    ["a 200 without the gateway's headers", 200, {}],
    ["a charge header not a count", 200, { ...charged(1, 2), "x-qt-ai-credits-charged": "1.5" }],
  ] as const)("%s: platform unavailable", async (_case, status, headers) => {
    const { fetch } = gateway(() => new Response("Invalid key test-key-x", { status, headers }))
    const error = await thrown(transportOn(fetch).send(request()))
    expect([error.safeMessage, error.providerCode]).toEqual([
      "ai.platform_unavailable",
      `gateway_http_${String(status)}`,
    ])
    expect(JSON.stringify(error)).not.toContain("test-key-x")
  })

  it("an unreachable gateway or a refused redirect: platform unavailable", async () => {
    const error = await thrown(
      transportOn(() => Promise.reject(new TypeError("fetch failed: redirect"))).send(request())
    )
    expect([error.safeMessage, error.providerCode]).toEqual([
      "ai.platform_unavailable",
      "gateway_unreachable",
    ])
  })

  it("its own time running out is a timeout; the caller letting go, an abort", async () => {
    const late = await thrown(transportOn(hanging).send(request({ timeoutMs: 20 })))
    expect([late.safeMessage, late.providerCode]).toEqual(["ai.timeout", "timeout"])
    const controller = new AbortController()
    const run = transportOn(hanging).send(request({ signal: controller.signal }))
    controller.abort()
    const gone = await thrown(run)
    expect([gone.safeMessage, gone.providerCode]).toEqual(["ai.timeout", "aborted"])
  })

  it("an answer over the cap is not read", async () => {
    const { fetch } = gateway(
      () => new Response(Buffer.alloc(2048), { status: 200, headers: charged(1, 1) })
    )
    const error = await thrown(transportOn(fetch).send(request({ maxResponseBytes: 1024 })))
    expect([error.safeMessage, error.providerCode]).toEqual([
      "ai.provider_response_invalid",
      "response_too_large",
    ])
  })
})

describe("platform transport: the gateway's refusals", () => {
  it.each([
    ["credits_exhausted", "ai.credits_exhausted"],
    ["daily_cap", "ai.credits_daily_cap"],
    ["call_cap", "ai.platform_unavailable"],
    ["provider_timeout", "ai.timeout"],
    ["provider_unreachable", "ai.provider_unavailable"],
    ["body_refused", "ai.input_unsupported"],
    ["body_too_large", "ai.input_unsupported"],
    ["unavailable", "ai.platform_unavailable"],
    ["task_mismatch", "ai.platform_unavailable"],
    ["not_offered", "ai.platform_unavailable"],
    ["a_code_from_the_future", "ai.platform_unavailable"],
  ])("%s → %s", async (code, key) => {
    const { fetch } = gateway(() => refusal(code, charged(0, 7)))
    const transport = transportOn(fetch)
    const error = await thrown(transport.send(request()))
    expect(isAiGatewayRefusal(error)).toBe(true)
    expect(isAiGatewayRefusal(error) && error.refusal).toBe(code)
    expect([error.provider, error.providerCode, error.safeMessage]).toEqual([
      "platform",
      `gateway_${code}`,
      key,
    ])
    expect(error.providerMessage).toBeUndefined()
    expect(transport.lastCharge()).toEqual({ credits: 0, balance: 7 })
  })

  it.each([
    ["not JSON", "credits_exhausted", "<html>no</html>"],
    ["another shape", "credits_exhausted", '{"error":"credits_exhausted"}'],
    [
      "a word too many",
      "credits_exhausted",
      '{"qt_ai_gateway":{"code":"credits_exhausted","message":"x"}}',
    ],
    [
      "the header naming another code",
      "daily_cap",
      '{"qt_ai_gateway":{"code":"credits_exhausted"}}',
    ],
    ["a code not of its shape", "Bad Code", '{"qt_ai_gateway":{"code":"Bad Code"}}'],
  ])("an envelope of %s is not believed: platform unavailable", async (_case, header, body) => {
    const { fetch } = gateway(
      () => new Response(body, { status: 402, headers: { "x-qt-ai-refusal": header } })
    )
    const error = await thrown(transportOn(fetch).send(request()))
    expect(isAiGatewayRefusal(error)).toBe(false)
    expect([error.safeMessage, error.providerCode]).toEqual([
      "ai.platform_unavailable",
      "gateway_refusal_invalid",
    ])
    expect(JSON.stringify(error)).not.toContain("html")
  })
})
