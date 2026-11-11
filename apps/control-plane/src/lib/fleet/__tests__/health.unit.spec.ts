import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { nextStanding, reportMissing, statusOutcome } from "../health-rules"
import { probeUrl } from "../health-probe"
import { storefrontPolicy, storefrontTargetProblem } from "../storefront-target"

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 11, 9, minutes))

describe("the health standing (Ek C13)", () => {
  it("turns unhealthy at the third failure in a row and healthy at the first answer", () => {
    const first = nextStanding(null, false, at(0))
    expect(first).toMatchObject({
      state: "failing",
      consecutive_failures: 1,
      unhealthy_since: null,
    })
    const second = nextStanding(first, false, at(5))
    expect(second).toMatchObject({ state: "failing", consecutive_failures: 2 })
    const third = nextStanding(second, false, at(10))
    expect(third).toMatchObject({ state: "unhealthy", consecutive_failures: 3 })
    expect(third.unhealthy_since).toEqual(at(10))
    // Still unhealthy: since the third failure, not the fourth
    expect(nextStanding(third, false, at(15)).unhealthy_since).toEqual(at(10))
    const back = nextStanding(third, true, at(20))
    expect(back).toEqual({
      state: "healthy",
      consecutive_failures: 0,
      last_ok_at: at(20),
      unhealthy_since: null,
    })
    // A failure after it keeps the last good time
    expect(nextStanding(back, false, at(25)).last_ok_at).toEqual(at(20))
  })

  it("reads a status: 200 only, a redirect named, anything else by its number", () => {
    expect(statusOutcome(200)).toEqual({ ok: true, error: null })
    expect(statusOutcome(204)).toEqual({ ok: false, error: "health.http_204" })
    expect(statusOutcome(301)).toEqual({ ok: false, error: "health.redirect" })
    expect(statusOutcome(503)).toEqual({ ok: false, error: "health.http_503" })
  })

  it("says the report is missing after three hours, from the last one or from the start", () => {
    const last = at(0)
    expect(reportMissing(last, new Date(last.getTime() + 3 * 3600_000))).toBe(false)
    expect(reportMissing(last, new Date(last.getTime() + 3 * 3600_000 + 1))).toBe(true)
    expect(reportMissing(null, at(30))).toBe(false)
    expect(reportMissing(null, new Date(last.getTime() + 4 * 3600_000), last)).toBe(true)
  })
})

describe("the storefront probe's policy (Ek C13)", () => {
  const deployed = storefrontPolicy(["Magaza.QuantTicaret.com", "mylarte.com"], {
    NODE_ENV: "production",
  })
  const local = storefrontPolicy([], { NODE_ENV: "development" })

  it("takes only the shop's own verified domains over https once deployed", () => {
    expect(storefrontTargetProblem("https://mylarte.com/", deployed)).toBeNull()
    expect(storefrontTargetProblem("https://magaza.quantticaret.com", deployed)).toBeNull()
    for (const url of [
      "http://mylarte.com/",
      "https://mylarte.com:8443/",
      "https://other.com/",
      "https://169.254.169.254/",
      "https://localhost:8000/",
    ]) {
      expect(storefrontTargetProblem(url, deployed)).toBe("target_not_allowed")
    }
  })

  it("takes this machine's 8000-8099 in development, and a base URL only", () => {
    expect(storefrontTargetProblem("http://localhost:8000", local)).toBeNull()
    expect(storefrontTargetProblem("http://127.0.0.1:8099/", local)).toBeNull()
    expect(storefrontTargetProblem("http://localhost:9000/", local)).toBe("target_not_allowed")
    expect(storefrontTargetProblem("http://example.com:8000/", local)).toBe("target_not_allowed")
    for (const url of [
      "http://localhost:8000/odeme",
      "http://localhost:8000/?a=1",
      "http://user:pw@localhost:8000/",
      "file:///etc/passwd",
      "not a url",
    ]) {
      expect(storefrontTargetProblem(url, local)).toBe("target_invalid")
    }
  })
})

describe("probeUrl (Ek C13)", () => {
  let server: Server
  let base: string
  const seen: string[] = []

  beforeAll(async () => {
    server = createServer((req, res) => {
      seen.push(req.url ?? "")
      if (req.url === "/health") {
        res.writeHead(200).end("OK")
      } else if (req.url === "/moved") {
        res.writeHead(301, { location: "/health" }).end()
      } else if (req.url === "/broken") {
        res.writeHead(503).end("down")
      }
      // Anything else never answers: a timeout
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
  })
  afterAll(() => {
    server.closeAllConnections()
    server.close()
  })

  it("is healthy on a 200, with its time", async () => {
    const result = await probeUrl(`${base}/health`, "backend")
    expect(result).toMatchObject({ target: "backend", ok: true, status_code: 200, error: null })
    expect(result.latency_ms).toBeGreaterThanOrEqual(0)
  })

  it("fails on a 5xx and on a redirect, which it never follows", async () => {
    seen.length = 0
    expect(await probeUrl(`${base}/broken`, "backend")).toMatchObject({
      ok: false,
      status_code: 503,
      error: "health.http_503",
    })
    expect(await probeUrl(`${base}/moved`, "storefront")).toMatchObject({
      ok: false,
      status_code: 301,
      error: "health.redirect",
    })
    expect(seen).toEqual(["/broken", "/moved"])
  })

  it("times out, and says so when nothing listens", async () => {
    expect(await probeUrl(`${base}/hang`, "backend", { timeoutMs: 200 })).toEqual({
      target: "backend",
      ok: false,
      status_code: null,
      latency_ms: null,
      error: "health.timeout",
    })
    expect(await probeUrl("http://127.0.0.1:9/health", "backend")).toMatchObject({
      ok: false,
      error: "health.unreachable",
    })
  })
})
