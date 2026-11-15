import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as Env from "@/lib/env"
import type { EdgeSite } from "@/lib/store-api/edge"
import { storeCaches } from "@/lib/store-api/registry"

const edge = vi.hoisted(() => ({
  edgeSite: vi.fn(),
  resolveForProxy: vi.fn(),
  reportNotFound: vi.fn(),
  backendFileResponse: vi.fn(),
  checkBypass: vi.fn(),
}))
vi.mock("@/lib/store-api/edge", () => edge)
vi.mock("@/lib/env", async (original) => ({
  ...(await original<typeof Env>()),
  storefrontEnv: () => ({ NODE_ENV: "development" }),
}))

const { proxy } = await import("../proxy")

const TOKEN = `mnb_AbCdEfGhIjKlMnOp.zzzzzzzz.${"A".repeat(43)}`

const site = (enabled: boolean, suspended = false): EdgeSite => ({
  suspended,
  indexing: true,
  canonicalHost: null,
  indexNowKey: null,
  shopName: "Örnek Atölye",
  tracking: { ga4: null, meta: null },
  maintenance: {
    enabled,
    title: null,
    message: null,
    expectedAt: null,
    allowPaths: ["/iletisim", "/onizleme/*"],
  },
})

const visit = (path: string, init: { method?: string; cookie?: string } = {}) =>
  proxy(
    new NextRequest(`http://localhost:8000${path}`, {
      method: init.method ?? "GET",
      headers: { "next-action": "7f00aa", ...(init.cookie ? { cookie: init.cookie } : {}) },
    })
  )

// What `NextResponse.next()` marks: the request goes on to Next
const passed = (response: Response) => response.headers.get("x-middleware-next") === "1"

/** adr/0053 Ek 2026-11-15: no Server Action by an open path's name, nor past the matcher. */
describe("the proxy's maintenance gate for writes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeCaches().busy.clear()
    edge.edgeSite.mockResolvedValue(site(true))
    edge.resolveForProxy.mockResolvedValue({ type: "entity", path: "/urun/bir-urun" })
    edge.checkBypass.mockResolvedValue("closed")
  })

  it("answers a dark shop's writes 503 wherever a page would take them", async () => {
    for (const path of [
      "/odeme/durum",
      "/odeme/sonuc/x",
      "/iletisim",
      "/onizleme",
      "/onizleme/x",
      "/ONIZLEME/x",
      "/bakim/gir",
    ]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
        const response = await visit(path, { method })
        expect(response.status, `${method} ${path}`).toBe(503)
      }
    }
  })

  it("keeps a card provider's return and every look the same", async () => {
    for (const path of ["/odeme/sonuc", "/odeme/sonuc/hata"]) {
      expect(passed(await visit(path, { method: "POST" })), path).toBe(true)
    }
    for (const method of ["GET", "HEAD"]) {
      for (const path of ["/odeme/durum", "/iletisim", "/onizleme/x", "/bakim/gir"]) {
        expect(passed(await visit(path, { method })), `${method} ${path}`).toBe(true)
      }
      expect((await visit("/", { method })).status).toBe(503)
    }
  })

  it("lets the bypass cookie write anywhere", async () => {
    edge.checkBypass.mockResolvedValue("open")
    for (const path of ["/", "/odeme/durum", "/iletisim", "/onizleme"]) {
      const response = await visit(path, { method: "POST", cookie: `qt_bypass=${TOKEN}` })
      expect(passed(response), path).toBe(true)
    }
  })

  it("changes nothing for an open shop", async () => {
    edge.edgeSite.mockResolvedValue(site(false))
    for (const path of ["/", "/odeme/durum", "/iletisim", "/onizleme"]) {
      expect(passed(await visit(path, { method: "POST" })), path).toBe(true)
    }
  })

  it("holds a suspended shop to the same rule, its open paths and cookie aside", async () => {
    edge.edgeSite.mockResolvedValue(site(true, true))
    edge.checkBypass.mockResolvedValue("open")
    for (const path of ["/odeme/durum", "/odeme/sonuc/x", "/iletisim", "/onizleme/x"]) {
      const response = await visit(path, { method: "POST", cookie: `qt_bypass=${TOKEN}` })
      expect(response.status, path).toBe(503)
    }
    expect(passed(await visit("/odeme/sonuc", { method: "POST" }))).toBe(true)
    expect(passed(await visit("/odeme/durum"))).toBe(true)
  })

  it("keeps the dev server's reload socket open in development", async () => {
    expect(passed(await visit("/_next/webpack-hmr"))).toBe(true)
  })
})

describe("the proxy on a file's name", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    edge.edgeSite.mockResolvedValue(site(true))
  })

  it("passes a file that lives there to GET and HEAD, dark or not, asking no backend", async () => {
    for (const path of ["/icon.svg", "/fonts/inter-latin.c940764593.woff2", "/marks/visa.png"]) {
      for (const method of ["GET", "HEAD"]) {
        expect(passed(await visit(path, { method })), `${method} ${path}`).toBe(true)
      }
    }
    expect(edge.edgeSite).not.toHaveBeenCalled()
  })

  it("answers a name no file lives at 404 itself, never the catch-all page", async () => {
    for (const path of [
      "/favicon.ico",
      "/apple-icon.png",
      "/manifest.webmanifest",
      "/fonts/yok-latin.0123456789.woff2",
      "/marks/bank_transfer.svg",
    ]) {
      const response = await visit(path)
      expect(response.status, path).toBe(404)
      expect(passed(response)).toBe(false)
      expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8")
      expect(await response.text()).toBe("Not Found")
      expect(await (await visit(path, { method: "HEAD" })).text()).toBe("")
    }
    expect(edge.edgeSite).not.toHaveBeenCalled()
  })

  it("answers any other method 405, file or not", async () => {
    for (const path of ["/favicon.ico", "/icon.svg", "/fonts/inter-latin.c940764593.woff2"]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
        const response = await visit(path, { method })
        expect(response.status, `${method} ${path}`).toBe(405)
        expect(response.headers.get("allow")).toBe("GET, HEAD")
      }
    }
    expect(edge.edgeSite).not.toHaveBeenCalled()
  })
})
