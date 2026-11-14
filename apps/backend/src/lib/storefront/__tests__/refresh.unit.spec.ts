import { createHmac, randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingHttpHeaders, Server } from "node:http"
import type { AddressInfo } from "node:net"
import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../../logging"
import { SafeFetchError } from "../../security/safe-fetch"
import {
  REFRESH_HEADERS,
  failureOf,
  isRefreshOn,
  refreshFetch,
  refreshRequest,
  refreshStorefront,
  refreshTarget,
  scopesForSection,
  signRefresh,
} from "../refresh"

// Generated per run: no fixed secret in the repo (docs/04)
const secret = randomBytes(32).toString("hex")

const hmac = (text: string) => createHmac("sha256", secret).update(text).digest("hex")

/** A container whose settings name the shop's canonical host. */
const containerWith = (canonicalHost: string | null) =>
  ({
    resolve: () => ({ getSection: () => Promise.resolve({ canonical_host: canonicalHost }) }),
  }) as unknown as Pick<MedusaContainer, "resolve">

describe("storefront refresh signal (adr/0048 ek 2026-11-03)", () => {
  it("signs `<time>.<nonce>.<scopes>` and sends the time in the body and a header", () => {
    const nonce = "0123456789abcdef0123456789abcdef"
    const request = refreshRequest(secret, ["settings", "layout", "settings"], 1_762_160_400, nonce)

    expect(JSON.parse(request.body)).toEqual({
      scopes: ["layout", "settings"],
      at: 1_762_160_400,
      nonce,
    })
    expect(request.headers[REFRESH_HEADERS.time]).toBe("1762160400")
    expect(request.headers[REFRESH_HEADERS.signature]).toBe(
      hmac(`1762160400.${nonce}.layout,settings`)
    )
    expect(signRefresh(secret, 1_762_160_400, nonce, ["layout"])).not.toBe(
      signRefresh(secret, 1_762_160_400, nonce, ["layout", "settings"])
    )
    // A fresh nonce each time: the storefront refuses one it has seen
    const [first, second] = [refreshRequest(secret, ["menus"]), refreshRequest(secret, ["menus"])]
    expect((JSON.parse(first.body) as { nonce: string }).nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(first.body).not.toBe(second.body)
  })

  it("goes to the set origin, else the canonical host once deployed, else nowhere", () => {
    const set = { NODE_ENV: "production" as const, STOREFRONT_ORIGIN: "https://vitrin.example.com" }

    expect(refreshTarget(set, "magaza.example.com")).toEqual({
      url: "https://vitrin.example.com/api/yenile",
      configured: true,
    })
    expect(refreshTarget({ NODE_ENV: "production" }, "magaza.example.com")).toEqual({
      url: "https://magaza.example.com/api/yenile",
      configured: false,
    })
    expect(refreshTarget({ NODE_ENV: "staging" }, null)).toBeNull()
    // A developer's machine knocks on its own storefront, never on the live shop's host
    expect(refreshTarget({ NODE_ENV: "development" }, "magaza.example.com")).toEqual({
      url: "http://localhost:8000/api/yenile",
      configured: true,
    })
  })

  it("names what a settings section's save changes on the storefront", () => {
    expect(scopesForSection("storefront")).toEqual(["settings"])
    expect(scopesForSection("seo")).toEqual(["settings", "site"])
    expect(scopesForSection("maintenance")).toEqual(["settings", "site"])
    expect(scopesForSection("legal")).toEqual(["settings", "legal"])
    expect(scopesForSection("payments")).toEqual([])
  })

  it("is off in tests unless a test turns it on, and on everywhere else", () => {
    expect(isRefreshOn({ NODE_ENV: "test" })).toBe(false)
    expect(isRefreshOn({ NODE_ENV: "test", QT_TEST_STOREFRONT_REFRESH: "1" })).toBe(true)
    expect(isRefreshOn({ NODE_ENV: "production" })).toBe(true)
    expect(isRefreshOn({ NODE_ENV: "development" })).toBe(true)
  })

  describe("sending", () => {
    let server: Server
    let status = 204
    let answer = ""
    const received: { url: string; headers: IncomingHttpHeaders; body: string }[] = []
    const port = () => (server.address() as AddressInfo).port
    const local = () => ({
      NODE_ENV: "test" as const,
      STOREFRONT_IP_SECRET: secret,
      STOREFRONT_ORIGIN: `http://127.0.0.1:${String(port())}`,
    })

    beforeAll(async () => {
      server = createServer((req, res) => {
        let body = ""
        req.on("data", (chunk: Buffer) => (body += chunk.toString()))
        req.on("end", () => {
          received.push({ url: req.url ?? "", headers: req.headers, body })
          res.writeHead(status).end(answer)
        })
      })
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    })

    afterAll(async () => {
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve()
        })
      )
    })

    beforeEach(() => {
      received.length = 0
      status = 204
      answer = ""
    })

    it("posts the signed scopes to the storefront and says it was sent", async () => {
      const outcome = await refreshStorefront(containerWith(null), ["layout"], { env: local() })

      const [call] = received
      const time = String(call?.headers[REFRESH_HEADERS.time])
      const body = JSON.parse(call?.body ?? "{}") as { scopes: string[]; at: number; nonce: string }
      expect(outcome).toBe("sent")
      expect(call?.url).toBe("/api/yenile")
      expect(body).toMatchObject({ scopes: ["layout"], at: Number(time) })
      expect(Math.abs(Date.now() / 1000 - body.at)).toBeLessThan(5)
      expect(call?.headers[REFRESH_HEADERS.signature]).toBe(hmac(`${time}.${body.nonce}.layout`))
    })

    it("reaches loopback on a developer's machine only", async () => {
      const url = `http://127.0.0.1:${String(port())}/api/yenile`
      const options = { method: "POST", allowedPorts: [port()], redirect: "error" as const }

      const fromLocal = await refreshFetch({ NODE_ENV: "development" })(url, options)
      const byName = await refreshFetch({ NODE_ENV: "test" })(
        `http://localhost:${String(port())}/api/yenile`,
        options
      )
      const deployed = await refreshFetch({ NODE_ENV: "production" })(url, options).catch(
        (error: unknown) => error
      )
      // A loopback origin set by mistake where the shop runs is refused, not sent
      const outcome = await refreshStorefront(containerWith(null), ["menus"], {
        env: { ...local(), NODE_ENV: "production" },
      })

      expect(fromLocal.status).toBe(204)
      expect(byName.status).toBe(204)
      expect(deployed).toMatchObject({ reason: "address_not_allowed" })
      expect(outcome).toBe("failed")
      expect(received).toHaveLength(2)
    })

    it("never throws: a refusing, unreachable or unset storefront is a failure or a skip", async () => {
      status = 500
      const refused = await refreshStorefront(containerWith(null), ["settings"], { env: local() })
      const timedOut = await refreshStorefront(containerWith(null), ["settings"], {
        env: local(),
        fetch: () => Promise.reject(new SafeFetchError("timeout")),
      })
      const noSecret = await refreshStorefront(containerWith(null), ["settings"], {
        env: { NODE_ENV: "test", STOREFRONT_ORIGIN: local().STOREFRONT_ORIGIN },
      })
      const nowhere = await refreshStorefront(containerWith(null), ["settings"], {
        env: { NODE_ENV: "production", STOREFRONT_IP_SECRET: secret },
      })
      const broken = await refreshStorefront(
        {
          resolve: () => {
            throw new Error("no settings")
          },
        },
        ["settings"],
        { env: { NODE_ENV: "production", STOREFRONT_IP_SECRET: secret } }
      )
      const nothing = await refreshStorefront(containerWith(null), [], { env: local() })

      expect([refused, timedOut, noSecret, nowhere, broken, nothing]).toEqual([
        "failed",
        "failed",
        "skipped",
        "skipped",
        "failed",
        "skipped",
      ])
      expect(received).toHaveLength(1)
    })

    it("logs a storefront's 500 by its status, though its error page is too long to read", async () => {
      // `next dev`'s error page: far over the 4 KB the signal reads
      status = 500
      answer = "x".repeat(20_000)
      const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)

      try {
        const outcome = await refreshStorefront(containerWith(null), ["layout"], { env: local() })

        expect(outcome).toBe("failed")
        expect(warn).toHaveBeenCalledWith({
          event: "storefront.refresh_failed",
          scopes: ["layout"],
          status: 500,
          reason: "status_not_ok",
        })
      } finally {
        warn.mockRestore()
      }
    })
  })

  it("classifies a failure by the answer's status when one came", () => {
    const tooLarge = (status?: number) =>
      new SafeFetchError("response_too_large", status === undefined ? {} : { status })

    expect(failureOf(tooLarge(502))).toEqual({ status: 502, reason: "status_not_ok" })
    // A 2xx whose body is over the limit is the size problem it says
    expect(failureOf(tooLarge(200))).toEqual({ status: 200, reason: "response_too_large" })
    expect(failureOf(tooLarge())).toEqual({ reason: "response_too_large" })
    expect(failureOf(new SafeFetchError("timeout"))).toEqual({ reason: "timeout" })
    expect(failureOf(new Error("boom"))).toHaveProperty("err")
  })
})
