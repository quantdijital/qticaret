import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EdgeSite } from "@/lib/store-api/edge"

// The backend's answer for a bypass token, as the test sets it
const edge = vi.hoisted(() => ({ checkBypass: vi.fn() }))
vi.mock("../../store-api/edge", () => edge)

const { maintenanceGate } = await import("../gate")

const TOKEN = `mnb_AbCdEfGhIjKlMnOp.zzzzzzzz.${"A".repeat(43)}`

const site = (enabled: boolean, suspended = false): EdgeSite => ({
  suspended,
  indexing: true,
  canonicalHost: null,
  indexNowKey: null,
  shopName: "Mağaza",
  tracking: { ga4: null, meta: null },
  maintenance: {
    enabled,
    title: null,
    message: null,
    expectedAt: null,
    allowPaths: ["/iletisim", "/sozlesmeler/*"],
  },
})

const context = { nonce: "n", csp: "default-src 'self'", production: false, visitorIp: null }

const request = (path: string, init: { method?: string; cookie?: string } = {}) =>
  new NextRequest(`http://localhost:8000${path}`, {
    method: init.method ?? "GET",
    headers: init.cookie ? { cookie: init.cookie } : {},
  })

describe("maintenanceGate", () => {
  beforeEach(() => {
    edge.checkBypass.mockReset()
  })

  it("lets everything through while the shop is open, asking nothing", async () => {
    const gate = await maintenanceGate(request("/"), "/", site(false), context)
    expect(gate).toEqual({ blocked: null, bypassed: false })
    expect(edge.checkBypass).not.toHaveBeenCalled()
  })

  it("answers a dark shop's page, Server Action and route alike with the 503", async () => {
    for (const [path, method] of [
      ["/", "GET"],
      ["/urun/keten-gomlek", "HEAD"],
      ["/sepet", "POST"],
      ["/siparis/order_1/fatura", "GET"],
    ] as const) {
      const gate = await maintenanceGate(request(path, { method }), path, site(true), context)
      expect(gate.blocked?.status).toBe(503)
      expect(gate.blocked?.headers.get("retry-after")).toBe("3600")
    }
    expect(edge.checkBypass).not.toHaveBeenCalled()
  })

  it("keeps the storefront's own open paths and the shop's open", async () => {
    for (const path of [
      "/odeme/sonuc",
      "/onizleme/x",
      "/bakim/gir",
      "/iletisim",
      "/sozlesmeler/kvkk",
    ]) {
      const gate = await maintenanceGate(request(path), path, site(true), context)
      expect(gate).toEqual({ blocked: null, bypassed: false })
    }
  })

  it("answers a Server Action posted under a preview with the 503, the bypass cookie aside", async () => {
    // `addToCart` posted to `/onizleme/x`: the root layout carries it on every route
    const action = (cookie?: string) =>
      new NextRequest("http://localhost:8000/onizleme/x", {
        method: "POST",
        headers: { "next-action": "7f00aa", ...(cookie ? { cookie } : {}) },
      })
    const dark = await maintenanceGate(action(), "/onizleme/x", site(true), context)
    expect(dark.blocked?.status).toBe(503)
    expect(edge.checkBypass).not.toHaveBeenCalled()
    // The shop's own people with a bypass link act as on any page
    edge.checkBypass.mockResolvedValue("open")
    const bypassed = await maintenanceGate(
      action(`qt_bypass=${TOKEN}`),
      "/onizleme/x",
      site(true),
      context
    )
    expect(bypassed).toEqual({ blocked: null, bypassed: true })
    // An open shop's preview acts as usual
    expect(await maintenanceGate(action(), "/onizleme/x", site(false), context)).toEqual({
      blocked: null,
      bypassed: false,
    })
  })

  it("lets a bypass cookie the backend accepts through, marked", async () => {
    edge.checkBypass.mockResolvedValue("open")
    const gate = await maintenanceGate(
      request("/", { cookie: `qt_bypass=${TOKEN}` }),
      "/",
      site(true),
      context
    )
    expect(gate).toEqual({ blocked: null, bypassed: true })
    expect(edge.checkBypass).toHaveBeenCalledWith(TOKEN, null)
  })

  it("clears a cookie the backend refuses, and one that never had the shape", async () => {
    edge.checkBypass.mockResolvedValue("closed")
    const refused = await maintenanceGate(
      request("/", { cookie: `qt_bypass=${TOKEN}` }),
      "/",
      site(true),
      context
    )
    expect(refused.blocked?.status).toBe(503)
    expect(refused.blocked?.headers.get("set-cookie")).toMatch(/^qt_bypass=;.*Max-Age=0/i)

    edge.checkBypass.mockClear()
    const forged = await maintenanceGate(
      request("/", { cookie: "qt_bypass=bozuk" }),
      "/",
      site(true),
      context
    )
    expect(forged.blocked?.headers.get("set-cookie")).toMatch(/^qt_bypass=;/)
    // A malformed token never reaches the backend
    expect(edge.checkBypass).not.toHaveBeenCalled()
  })

  it("keeps the cookie when the backend gave no answer, the page dark this once", async () => {
    edge.checkBypass.mockResolvedValue("unknown")
    const gate = await maintenanceGate(
      request("/", { cookie: `qt_bypass=${TOKEN}` }),
      "/",
      site(true),
      context
    )
    expect(gate.blocked?.status).toBe(503)
    expect(gate.blocked?.headers.get("set-cookie")).toBeNull()
  })

  it("reads the `__Host-` cookie in production", async () => {
    edge.checkBypass.mockResolvedValue("open")
    const gate = await maintenanceGate(
      request("/", { cookie: `qt_bypass=${TOKEN}` }),
      "/",
      site(true),
      { ...context, production: true }
    )
    // The plain name is a developer's; production looks for its own
    expect(gate.blocked?.status).toBe(503)
    const hosted = await maintenanceGate(
      request("/", { cookie: `__Host-qt_bypass=${TOKEN}` }),
      "/",
      site(true),
      { ...context, production: true }
    )
    expect(hosted).toEqual({ blocked: null, bypassed: true })
  })
})

/** adr/0061 Ek C15: the platform's suspension, open or dark the shop's maintenance. */
describe("maintenanceGate for a suspended shop", () => {
  beforeEach(() => {
    edge.checkBypass.mockReset()
    edge.checkBypass.mockResolvedValue("open")
  })

  it("darkens the shop's open paths and previews, a bypass cookie asked nothing", async () => {
    for (const maintenance of [false, true]) {
      for (const path of ["/", "/iletisim", "/sozlesmeler/kvkk", "/onizleme/x", "/bakim/gir"]) {
        const gate = await maintenanceGate(
          request(path, { cookie: `qt_bypass=${TOKEN}` }),
          path,
          site(maintenance, true),
          context
        )
        expect(gate.blocked?.status).toBe(503)
        expect(gate.blocked?.headers.get("retry-after")).toBe("3600")
        // The cookie is the shop's maintenance business: neither checked nor cleared here
        expect(gate.blocked?.headers.get("set-cookie")).toBeNull()
        expect(await gate.blocked?.text()).toContain("Mağaza şu anda hizmet vermiyor")
      }
    }
    expect(edge.checkBypass).not.toHaveBeenCalled()
  })

  it("keeps robots.txt, the sitemaps and a card provider's return open", async () => {
    for (const path of ["/robots.txt", "/sitemap.xml", "/odeme/sonuc", "/odeme/durum/x"]) {
      const gate = await maintenanceGate(request(path), path, site(false, true), context)
      expect(gate).toEqual({ blocked: null, bypassed: false })
    }
  })

  it("answers a HEAD with the headers alone", async () => {
    const gate = await maintenanceGate(
      request("/", { method: "HEAD" }),
      "/",
      site(false, true),
      context
    )
    expect(gate.blocked?.status).toBe(503)
    expect(await gate.blocked?.text()).toBe("")
  })
})
