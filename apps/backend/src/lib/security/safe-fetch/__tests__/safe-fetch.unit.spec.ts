import { SafeFetchError, isSafeFetchError } from "../errors"
import { safeFetch } from "../safe-fetch"
import {
  LOOPBACK,
  PRIVATE,
  failureOf,
  fetchAsPublic,
  fetchWithRealRule,
  onPort,
  publicUrl,
  resolveTo,
} from "./helpers"
import { startServer } from "./test-server"
import type { TestServer } from "./test-server"

const servers: TestServer[] = []
const serve = async (handler: Parameters<typeof startServer>[0]): Promise<TestServer> => {
  const server = await startServer(handler)
  servers.push(server)
  return server
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
})

describe("safeFetch", () => {
  it("fetches an allowed host", async () => {
    const server = await serve((_req, res) => res.end("hello"))

    const response = await fetchAsPublic()(publicUrl(server, "/data?x=1"), onPort(server))

    expect(response.status).toBe(200)
    expect(response.body.toString()).toBe("hello")
    expect(server.received[0]).toMatchObject({ method: "GET", path: "/data?x=1" })
    expect(server.received[0]?.headers.host).toBe(`public.test:${String(server.port)}`)
  })

  describe("internal addresses", () => {
    it("refuses a loopback literal, without connecting", async () => {
      const server = await serve((_req, res) => res.end())

      const reason = await failureOf(
        safeFetch(`http://127.0.0.1:${String(server.port)}/`, onPort(server))
      )

      expect(reason).toBe("address_not_allowed")
      expect(server.received).toHaveLength(0)
    })

    it("refuses localhost through the system resolver", async () => {
      const server = await serve((_req, res) => res.end())

      // c-ares skips /etc/hosts: localhost either does not resolve or resolves inside
      const reason = await failureOf(
        safeFetch(`http://localhost:${String(server.port)}/`, onPort(server, { timeoutMs: 5000 }))
      )

      expect(["dns_failed", "address_not_allowed"]).toContain(reason)
      expect(server.received).toHaveLength(0)
    })

    it("refuses a name that resolves to a private address", async () => {
      const reason = await failureOf(
        fetchWithRealRule(resolveTo([PRIVATE]))("http://internal.test/")
      )

      expect(reason).toBe("address_not_allowed")
    })

    it("refuses when any of the answers is not allowed", async () => {
      const server = await serve((_req, res) => res.end())

      const reason = await failureOf(
        fetchAsPublic(resolveTo([LOOPBACK, PRIVATE]))(publicUrl(server), onPort(server))
      )

      expect(reason).toBe("address_not_allowed")
      expect(server.received).toHaveLength(0)
    })

    it.each([
      "http://0x7f.1/",
      "http://2130706433/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::ffff:127.0.0.1]/",
      "http://[::127.0.0.1]/",
      "http://[::1]/",
      "http://[fd00::1]/",
    ])("refuses the address form %s", async (url) => {
      expect(await failureOf(safeFetch(url))).toBe("address_not_allowed")
    })
  })

  describe("DNS rebinding", () => {
    it("connects to the address it checked, resolving once", async () => {
      const server = await serve((_req, res) => res.end("pinned"))
      // A rebinding resolver: allowed on the first answer, internal afterwards
      const resolve = resolveTo([LOOPBACK], [PRIVATE])

      const response = await fetchAsPublic(resolve)(
        `http://rebind.test:${String(server.port)}/`,
        onPort(server)
      )

      expect(response.body.toString()).toBe("pinned")
      expect(resolve.calls).toEqual(["rebind.test"])
    })
  })

  describe("limits", () => {
    it("refuses a declared length over the limit before reading", async () => {
      // Declares 2000 bytes, sends one and stalls: only the header check ends this quickly
      const server = await serve((_req, res) => {
        res.writeHead(200, { "content-length": "2000" })
        res.write("x")
      })
      const started = Date.now()

      const reason = await failureOf(
        fetchAsPublic()(
          publicUrl(server),
          onPort(server, { maxResponseBytes: 1000, timeoutMs: 3000 })
        )
      )

      expect(reason).toBe("response_too_large")
      expect(Date.now() - started).toBeLessThan(2000)
    })

    it("stops reading a streamed response past the limit", async () => {
      const server = await serve((_req, res) => {
        res.write("x".repeat(800))
        res.write("x".repeat(800))
        res.end()
      })

      const reason = await failureOf(
        fetchAsPublic()(publicUrl(server), onPort(server, { maxResponseBytes: 1000 }))
      )

      expect(reason).toBe("response_too_large")
    })

    it("accepts a HEAD answer that declares a large length", async () => {
      const server = await serve((_req, res) => {
        res.writeHead(200, { "content-length": "999999" }).end()
      })

      const response = await fetchAsPublic()(
        publicUrl(server),
        onPort(server, { method: "HEAD", maxResponseBytes: 1000 })
      )

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(0)
    })

    it("times out a server that never answers", async () => {
      const server = await serve(() => undefined)

      const reason = await failureOf(
        fetchAsPublic()(publicUrl(server), onPort(server, { timeoutMs: 200 }))
      )

      expect(reason).toBe("timeout")
    })

    it("times out a body that trickles in", async () => {
      const server = await serve((_req, res) => {
        res.writeHead(200)
        const timer = setInterval(() => res.write("x"), 50)
        res.on("close", () => {
          clearInterval(timer)
        })
      })

      const reason = await failureOf(
        fetchAsPublic()(publicUrl(server), onPort(server, { timeoutMs: 300 }))
      )

      expect(reason).toBe("timeout")
    })

    it("times out a resolver that never answers", async () => {
      const hanging = fetchAsPublic(() => new Promise(() => undefined))

      expect(await failureOf(hanging("http://slow-dns.test/", { timeoutMs: 100 }))).toBe("timeout")
    })

    it("reports a cancellation by the caller", async () => {
      const server = await serve(() => undefined)
      const controller = new AbortController()
      setTimeout(() => {
        controller.abort()
      }, 50)

      const reason = await failureOf(
        fetchAsPublic()(publicUrl(server), onPort(server, { signal: controller.signal }))
      )

      expect(reason).toBe("aborted")
    })

    it.each([
      ["maxResponseBytes", { maxResponseBytes: Number.NaN }],
      ["timeoutMs", { timeoutMs: 0 }],
      ["maxRedirects", { maxRedirects: -1 }],
      ["an infinite limit", { maxResponseBytes: Number.POSITIVE_INFINITY }],
    ])("throws for an invalid %s", async (_label, options) => {
      await expect(safeFetch("http://example.com/", options)).rejects.toThrow(RangeError)
    })
  })

  describe("URL checks", () => {
    it.each([
      ["not a URL", "not a url", "invalid_url"],
      ["file", "file:///etc/passwd", "protocol_not_allowed"],
      ["ftp", "ftp://files.example.com/x", "protocol_not_allowed"],
      ["data", "data:text/plain,hi", "protocol_not_allowed"],
      ["gopher", "gopher://example.com/", "protocol_not_allowed"],
      ["credentials", "http://user:pass@example.com/", "credentials_in_url"],
      ["a port outside the allow list", "http://example.com:6379/", "port_not_allowed"],
    ])("refuses %s", async (_label, url, reason) => {
      expect(await failureOf(safeFetch(url))).toBe(reason)
    })

    it("reports a failed and an empty lookup", async () => {
      const failing = fetchAsPublic(() => Promise.reject(new Error("ENOTFOUND")))

      expect(await failureOf(failing("http://missing.test/"))).toBe("dns_failed")
      expect(await failureOf(fetchAsPublic(resolveTo([]))("http://empty.test/"))).toBe("dns_failed")
    })

    it.each([
      ["a URL without a scheme", "discord.com/api/webhooks/123/SECRET-TOKEN"],
      ["a refused address", "http://10.0.0.1/hooks/SECRET-TOKEN"],
    ])("keeps %s out of the error", async (_label, url) => {
      let caught: unknown
      try {
        await safeFetch(url)
      } catch (error) {
        caught = error
      }

      expect(caught).toBeInstanceOf(SafeFetchError)
      const error = caught as SafeFetchError
      expect(`${error.message} ${JSON.stringify(error)} ${String(error.cause)}`).not.toContain(
        "SECRET-TOKEN"
      )
    })
  })

  it("is recognised after a JSON round trip, as workflow errors arrive", () => {
    const plain: unknown = JSON.parse(JSON.stringify(new SafeFetchError("timeout")))

    expect(isSafeFetchError(plain)).toBe(true)
    expect(isSafeFetchError({ name: "Error", reason: "timeout" })).toBe(false)
  })
})
