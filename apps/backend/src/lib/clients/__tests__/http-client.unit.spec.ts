import { z } from "@medusajs/framework/zod"
import { isProviderError } from "../../errors"
import { runWithRequestContext } from "../../logging"
import { TransportRefusal } from "../transport"
import { Item, clientFor, closedPort, errorOf, json, sequence, useProvider } from "./harness"

const provider = useProvider()
const client = (extra: Parameters<typeof clientFor>[1] = {}) => clientFor(provider, extra)

describe("createHttpClient", () => {
  it("returns the parsed body and sends JSON with the request ID", async () => {
    provider.setHandler(json(200, { id: "i_1" }))

    const item = await runWithRequestContext({ requestId: "req-12345678" }, () =>
      client().http.request({ method: "POST", path: "/items", json: { a: 1 }, schema: Item })
    )

    expect(item).toEqual({ id: "i_1" })
    expect(provider.requests[0]?.headers["x-request-id"]).toBe("req-12345678")
    expect(provider.requests[0]?.headers["content-type"]).toBe("application/json")
  })

  it("sends form fields URL-encoded (PayTR's APIs)", async () => {
    provider.setHandler(json(200, { id: "i_1" }))

    await client().http.request({
      method: "POST",
      path: "/odeme/iade",
      form: { merchant_oid: "SIP001", note: "a&b=ç" },
      schema: Item,
    })

    expect(provider.requests[0]?.headers["content-type"]).toBe("application/x-www-form-urlencoded")
    expect(new URLSearchParams(provider.requests[0]?.body)).toEqual(
      new URLSearchParams({ merchant_oid: "SIP001", note: "a&b=ç" })
    )
  })

  it("sends an XML document as written and hands its answer back as text (SOAP carriers)", async () => {
    provider.setHandler((_req, res) => {
      res.writeHead(200, { "content-type": "text/xml" }).end("<ok>1</ok>")
    })

    const text = await client().http.request({
      method: "POST",
      path: "/service.asmx",
      xml: "<Envelope/>",
      schema: z.string(),
    })

    expect(text).toBe("<ok>1</ok>")
    expect(provider.requests[0]?.headers["content-type"]).toBe("text/xml; charset=utf-8")
    expect(provider.requests[0]?.body).toBe("<Envelope/>")
  })

  it("refuses a request with both a JSON and a form body before sending it", async () => {
    const error = await errorOf(
      client().http.request({ method: "POST", path: "/x", json: {}, form: {}, schema: Item })
    )

    expect(error).toMatchObject({ name: "HttpClientMisuse" })
    expect(provider.requests).toHaveLength(0)
  })

  it("keeps the base URL's path prefix and encodes segments", async () => {
    provider.setHandler(json(200, { id: "i_1" }))
    const { http } = client({ baseUrl: `${provider.baseUrl()}/api/v1` })

    await http.request({
      path: ["shipments", "../webhooks/wh 1"],
      query: { page: 2 },
      schema: Item,
    })

    expect(provider.requests[0]?.url).toBe("/api/v1/shipments/..%2Fwebhooks%2Fwh%201?page=2")
  })

  describe("retries", () => {
    it("retries an idempotent request on 503 with backoff, then succeeds", async () => {
      provider.setHandler(sequence(json(503, {}), json(503, {}), json(200, { id: "i_1" })))

      const item = await client().http.request({ path: "/items/1", schema: Item })

      expect(item.id).toBe("i_1")
      expect(provider.requests).toHaveLength(3)
      // Full jitter at random() = 0.5: half of 200 ms, then half of 400 ms
      expect(provider.sleeps).toEqual([100, 200])
    })

    it.each(["POST", "PATCH"])("sends a %s once by default", async (method) => {
      provider.setHandler(json(503, {}))

      const error = await errorOf(client().http.request({ method, path: "/pay", schema: Item }))

      expect(provider.requests).toHaveLength(1)
      expect(error).toMatchObject({ providerCode: "http_503", retryable: true })
    })

    it("repeats a POST marked idempotent and never a GET marked otherwise", async () => {
      provider.setHandler(json(503, {}))

      await errorOf(
        client().http.request({ method: "POST", path: "/pay", idempotent: true, schema: Item })
      )
      expect(provider.requests).toHaveLength(3)

      provider.requests.length = 0
      await errorOf(client().http.request({ path: "/x", idempotent: false, schema: Item }))
      expect(provider.requests).toHaveLength(1)
    })

    it("waits as long as Retry-After asks on 429, plus a little jitter", async () => {
      provider.setHandler(sequence(json(429, {}, { "retry-after": "2" }), json(200, { id: "i_1" })))

      await client().http.request({ path: "/items/1", schema: Item })

      expect(provider.sleeps).toEqual([2100])
    })

    it("gives up on a long Retry-After and reports it on the ProviderError", async () => {
      provider.setHandler(json(429, {}, { "retry-after": "120" }))

      const error = await errorOf(client().http.request({ path: "/items/1", schema: Item }))

      expect(isProviderError(error)).toBe(true)
      expect(error).toMatchObject({
        providerCode: "http_429",
        retryable: true,
        retryAfterMs: 120_000,
      })
      expect(provider.requests).toHaveLength(1)
    })
  })

  describe("unknown outcomes (no double charge)", () => {
    it("reports a POST that timed out as outcome_unknown, not retryable", async () => {
      provider.setHandler(() => undefined)

      const error = await errorOf(
        client({ timeoutMs: 100 }).http.request({ method: "POST", path: "/pay", schema: Item })
      )

      expect(error).toMatchObject({ providerCode: "outcome_unknown", retryable: false })
      expect(provider.requests).toHaveLength(1)
    })

    it.each([500, 502, 504])(
      "reports a POST answered with %i as outcome_unknown",
      async (status) => {
        provider.setHandler(json(status, {}))

        const error = await errorOf(
          client().http.request({ method: "POST", path: "/pay", schema: Item })
        )

        expect(error).toMatchObject({ providerCode: "outcome_unknown", retryable: false })
      }
    )

    it("retries a POST that certainly never left (connection refused)", async () => {
      const { http } = client({ baseUrl: `http://127.0.0.1:${String(await closedPort())}` })

      const error = await errorOf(http.request({ method: "POST", path: "/pay", schema: Item }))

      expect(error).toMatchObject({ providerCode: "network_error", retryable: true })
      expect(provider.sleeps).toHaveLength(2)
    })
  })

  describe("errors", () => {
    it.each([
      [400, "http_400", false],
      [404, "http_404", false],
      [500, "http_500", false],
      [502, "http_502", true],
    ])("maps a GET answered with %i", async (status, providerCode, retryable) => {
      provider.setHandler(json(status, { message: "provider text" }))

      const error = await errorOf(
        client({ retry: { attempts: 1 } }).http.request({ path: "/i", schema: Item })
      )

      expect(error).toMatchObject({ providerCode, retryable })
    })

    it("takes the provider's own code from the error body", async () => {
      provider.setHandler(json(402, { error: { code: "card_declined" } }))
      const errorCode = (body: unknown) => (body as { error?: { code?: string } }).error?.code

      const error = await errorOf(
        client({ errorCode }).http.request({ method: "POST", path: "/pay", schema: Item })
      )

      expect(error).toMatchObject({ providerCode: "card_declined", retryable: false })
    })

    it("keeps a provider's sentence out: only a short token is its code", async () => {
      provider.setHandler(json(403, { error: { code: "The caller <x@example.com> may not" } }))
      const errorCode = (body: unknown) => (body as { error?: { code?: string } }).error?.code

      const error = await errorOf(
        client({ errorCode }).http.request({ method: "POST", path: "/pay", schema: Item })
      )

      expect(error).toMatchObject({ providerCode: "http_403" })
    })

    it("refuses a body that does not match the schema or is not JSON", async () => {
      provider.setHandler(sequence(json(200, { id: 42 }), (_req, res) => res.end("<html>")))
      const { http } = client()

      expect(await errorOf(http.request({ path: "/a", schema: Item }))).toMatchObject({
        providerCode: "invalid_response",
      })
      expect(await errorOf(http.request({ path: "/a", schema: Item }))).toMatchObject({
        providerCode: "invalid_response",
      })
    })

    it.each([
      ["a declared length", json(200, { id: "x".repeat(2000) })],
      [
        "a streamed body",
        (_req: unknown, res: { write: (s: string) => void; end: (s: string) => void }) => {
          res.write("x".repeat(800))
          res.end("x".repeat(800))
        },
      ],
    ])("refuses a response over the size limit by %s", async (_label, sized) => {
      provider.setHandler(sized)

      const error = await errorOf(
        client({ maxResponseBytes: 1000 }).http.request({ path: "/big", schema: Item })
      )

      expect(error).toMatchObject({ providerCode: "response_too_large", retryable: false })
      expect(provider.requests).toHaveLength(1)
    })

    it("reports a URL the transport refused, without retrying", async () => {
      let calls = 0
      const transport = () => {
        calls += 1
        return Promise.reject(new TransportRefusal("refused: address_not_allowed"))
      }

      const error = await errorOf(
        client({ transport }).http.request({ path: "/hook", schema: Item })
      )

      expect(error).toMatchObject({ providerCode: "url_not_allowed", retryable: false })
      expect(calls).toBe(1)
    })

    it("stops on a cancellation by the caller, without retrying", async () => {
      provider.setHandler(() => undefined)
      const controller = new AbortController()
      setTimeout(() => {
        controller.abort()
      }, 50)

      const error = await errorOf(
        client().http.request({ path: "/slow", signal: controller.signal, schema: Item })
      )

      expect(error).toMatchObject({ providerCode: "aborted", retryable: false })
      expect(provider.sleeps).toHaveLength(0)
    })

    it("ends a call whose transport ignores the timeout", async () => {
      const transport = () => new Promise<never>(() => undefined)

      const error = await errorOf(
        client({ transport, timeoutMs: 50, retry: { attempts: 1 } }).http.request({
          path: "/x",
          schema: Item,
        })
      )

      expect(error).toMatchObject({ providerCode: "network_error" })
    })
  })
})
