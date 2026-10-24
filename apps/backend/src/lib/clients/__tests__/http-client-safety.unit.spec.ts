import { createHttpClient } from "../http-client"
import { HttpClientMisuse } from "../request"
import { TransportRefusal } from "../transport"
import { Item, clientFor, errorOf, json, spyLogger, useProvider } from "./harness"

const provider = useProvider()
const client = (extra: Parameters<typeof clientFor>[1] = {}) => clientFor(provider, extra)

describe("createHttpClient safety", () => {
  describe("misuse", () => {
    it.each([
      ["a GET with a body", { path: "/x", json: { a: 1 } }],
      ["a parent segment", { path: "/a/../admin" }],
      ["an encoded parent segment", { path: "/a/%2e%2e/admin" }],
      ["a fragment", { path: "/x#y" }],
      ["a query in the path", { path: "/x?force=true" }],
      ["a backslash", { path: "/x\\y" }],
      ["a relative path", { path: "x" }],
      ["a dot segment in the list", { path: ["a", ".."] }],
      ["a body that cannot be serialized", { method: "POST", path: "/x", json: { n: 1n } }],
    ])("refuses %s before sending", async (_label, request) => {
      const error = await errorOf(client().http.request({ ...request, schema: Item }))

      expect(error).toBeInstanceOf(HttpClientMisuse)
      expect(provider.requests).toHaveLength(0)
    })

    it("names the header, never its value, when a value is invalid", async () => {
      const error = await errorOf(
        client().http.request({
          path: "/x",
          headers: { "X-Api-Key": "key-123\nsecret" },
          schema: Item,
        })
      )

      expect(error).toBeInstanceOf(HttpClientMisuse)
      expect((error as Error).message).toContain("x-api-key")
      expect((error as Error).message).not.toContain("key-123")
    })

    it("refuses a base URL with credentials", () => {
      expect(() =>
        createHttpClient({ provider: "acme", baseUrl: "https://u:p@api.example" })
      ).toThrow(HttpClientMisuse)
    })

    it.each([
      ["attempts", { retry: { attempts: Number.NaN } }],
      ["timeoutMs", { timeoutMs: 0 }],
      ["maxRetryAfterMs", { retry: { maxRetryAfterMs: Number.POSITIVE_INFINITY } }],
    ])("refuses an invalid %s", (_label, options) => {
      expect(() =>
        createHttpClient({ provider: "acme", baseUrl: "https://api.example", ...options })
      ).toThrow(RangeError)
    })
  })

  describe("circuit breaker", () => {
    it("opens after repeated failures and lets one trial through after the reset", async () => {
      let now = 0
      provider.setHandler(json(502, {}))
      const { http } = client({
        now: () => now,
        retry: { attempts: 1 },
        circuitBreaker: { failureThreshold: 2, resetAfterMs: 1000 },
      })

      await errorOf(http.request({ path: "/a", schema: Item }))
      await errorOf(http.request({ path: "/a", schema: Item }))
      expect(await errorOf(http.request({ path: "/a", schema: Item }))).toMatchObject({
        providerCode: "circuit_open",
      })
      expect(provider.requests).toHaveLength(2)

      now = 1000
      provider.setHandler(json(200, { id: "i_1" }))
      await expect(http.request({ path: "/a", schema: Item })).resolves.toEqual({ id: "i_1" })
    })

    it("is not held half-open by a trial that never reached the provider", async () => {
      let now = 0
      let refuse = false
      provider.setHandler(json(502, {}))
      const { http } = client({
        now: () => now,
        retry: { attempts: 1 },
        circuitBreaker: { failureThreshold: 1, resetAfterMs: 1000 },
      })
      await errorOf(http.request({ path: "/a", schema: Item }))
      now = 1000

      // A misuse and a refused URL during the half-open window
      await errorOf(http.request({ path: "/a", json: {}, schema: Item }))
      const refusing = client({
        now: () => now,
        transport: () =>
          refuse ? Promise.reject(new TransportRefusal("refused")) : Promise.reject(new Error("x")),
      })
      refuse = true
      await errorOf(refusing.http.request({ path: "/a", schema: Item }))

      provider.setHandler(json(200, { id: "i_1" }))
      await expect(http.request({ path: "/a", schema: Item })).resolves.toEqual({ id: "i_1" })
    })

    it("does not count a client error as a provider failure", async () => {
      provider.setHandler(json(404, {}))
      const { http } = client({ retry: { attempts: 1 }, circuitBreaker: { failureThreshold: 1 } })

      await errorOf(http.request({ path: "/a", schema: Item }))

      expect(await errorOf(http.request({ path: "/a", schema: Item }))).toMatchObject({
        providerCode: "http_404",
      })
    })
  })

  describe("logs (F2 KK: no Authorization or API key)", () => {
    const ALLOWED = [
      "event",
      "provider",
      "method",
      "path",
      "attempt",
      "duration_ms",
      "status",
      "outcome",
      "error",
    ]

    it("carry only fixed fields, so headers, query and body never reach the logger", async () => {
      provider.setHandler(json(200, { id: "i_1", v: "zzz-4" }))
      const spy = spyLogger()
      const { http } = client({
        logger: spy.logger,
        defaultHeaders: { Authorization: "Bearer live-auth-123", "X-Partner": "zzz-1" },
      })

      await http.request({
        method: "POST",
        path: "/items",
        query: { k: "zzz-2" },
        json: { v: "zzz-3" },
        schema: Item,
      })

      expect(spy.calls).toHaveLength(1)
      for (const fields of spy.calls) {
        expect(Object.keys(fields).every((key) => ALLOWED.includes(key))).toBe(true)
      }
      expect(JSON.stringify(spy.calls)).not.toMatch(/live-auth-123|zzz-/)
    })

    it("hide the path for webhook clients and use a logPath when given", async () => {
      const hidden = spyLogger()
      await client({ logger: hidden.logger, hidePaths: true })
        .http.request({ path: "/services/T0/SECRET", schema: Item })
        .catch(() => undefined)
      const templated = spyLogger()
      await client({ logger: templated.logger })
        .http.request({ path: "/bot123/send", logPath: "/bot:token/send", schema: Item })
        .catch(() => undefined)

      expect(hidden.calls[0]?.["path"]).toBe("[hidden]")
      expect(templated.calls[0]?.["path"]).toBe("/bot:token/send")
    })

    it("describe a network error by name and code only", async () => {
      const transport = () =>
        Promise.reject(
          Object.assign(new Error("socket hang up Bearer leaked-1"), { code: "ECONNRESET" })
        )
      const spy = spyLogger()

      await errorOf(
        client({ transport, logger: spy.logger, retry: { attempts: 1 } }).http.request({
          path: "/x",
          schema: Item,
        })
      )

      expect(spy.calls[0]).toMatchObject({
        outcome: "network_error",
        error: { name: "Error", code: "ECONNRESET" },
      })
      expect(JSON.stringify(spy.calls)).not.toContain("leaked-1")
    })
  })
})
