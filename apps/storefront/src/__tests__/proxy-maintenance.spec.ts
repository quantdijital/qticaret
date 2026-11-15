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

  it("darkens what is below the payment pages, their exact paths open", async () => {
    for (const path of ["/odeme/durum/x", "/odeme/sonuc/x", "/odeme/sonuc/hata/x"]) {
      expect((await visit(path)).status, path).toBe(503)
    }
    for (const path of ["/odeme/durum", "/odeme/sonuc", "/odeme/sonuc/hata"]) {
      expect(passed(await visit(path)), path).toBe(true)
    }
  })
})

/**
 * adr/0053 Ek 2026-11-15, second review: a POST to a build file that is not
 * there falls to the catch-all page, which runs the Server Action it carries.
 * The matcher sends such a request here (`proxy-matcher.spec.ts`).
 */
describe("the proxy under /_next/", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeCaches().busy.clear()
    edge.edgeSite.mockResolvedValue(site(true))
    edge.resolveForProxy.mockResolvedValue({ type: "entity", path: "/urun/bir-urun" })
  })

  it("answers anything but GET and HEAD 405 before any 301, dark shop or open", async () => {
    for (const enabled of [true, false]) {
      edge.edgeSite.mockResolvedValue(site(enabled))
      for (const path of [
        "/_next/static/x.js",
        "/_next/static/chunks/a.js",
        "/_next/static/x.js/",
        "/_next/image",
        "/_next/data/b/x.json",
        "/_next/hmr",
      ]) {
        for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
          const response = await visit(path, { method })
          expect(response.status, `${method} ${path}`).toBe(405)
          expect(response.headers.get("allow")).toBe("GET, HEAD")
        }
      }
    }
    expect(edge.edgeSite).not.toHaveBeenCalled()
  })

  it("passes a build file's and an image's GET and HEAD on to Next, asking no backend", async () => {
    for (const method of ["GET", "HEAD"]) {
      for (const path of ["/_next/static/chunks/a.js", "/_next/image", "/_next/image/x"]) {
        expect(passed(await visit(path, { method })), `${method} ${path}`).toBe(true)
      }
    }
    expect(edge.edgeSite).not.toHaveBeenCalled()
  })

  it("keeps `/_next/data/` reads as they were: through the gate", async () => {
    expect((await visit("/_next/data/b/x.json")).status).toBe(503)
    edge.edgeSite.mockResolvedValue(site(false))
    expect(passed(await visit("/_next/data/b/x.json"))).toBe(true)
    expect(edge.edgeSite).toHaveBeenCalledTimes(2)
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
