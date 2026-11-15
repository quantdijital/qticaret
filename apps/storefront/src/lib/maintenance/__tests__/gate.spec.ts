import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TOKEN, context, request, site } from "./gate-fixtures"

/** adr/0053: the shop's own maintenance, its open paths and the bypass cookie. */

// The backend's answer for a bypass token, as the test sets it
const edge = vi.hoisted(() => ({ checkBypass: vi.fn() }))
vi.mock("../../store-api/edge", () => edge)

const { maintenanceGate } = await import("../gate")

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

  // adr/0053 Ek 2026-11-15: an open path is open to look at; a write needs the cookie
  it("answers a write by an open path's name with the 503, the bypass cookie aside", async () => {
    const writes = [
      ["/odeme/durum", "POST"],
      ["/odeme/durum/x", "POST"],
      ["/odeme/sonuc/x", "POST"],
      ["/iletisim", "POST"],
      ["/sozlesmeler/kvkk", "POST"],
      ["/onizleme", "POST"],
      ["/ONIZLEME/x", "POST"],
      ["/bakim/gir", "POST"],
      ["/favicon.ico", "POST"],
      ["/onizleme/x", "PUT"],
      ["/iletisim", "PATCH"],
      ["/odeme/durum", "DELETE"],
      ["/robots.txt", "OPTIONS"],
    ] as const
    for (const [path, method] of writes) {
      const action = (cookie?: string) =>
        new NextRequest(`http://localhost:8000${path}`, {
          method,
          headers: { "next-action": "7f00aa", ...(cookie ? { cookie } : {}) },
        })
      const dark = await maintenanceGate(action(), path, site(true), context)
      expect(dark.blocked?.status, `${method} ${path}`).toBe(503)
      edge.checkBypass.mockResolvedValue("open")
      const bypassed = await maintenanceGate(
        action(`qt_bypass=${TOKEN}`),
        path,
        site(true),
        context
      )
      expect(bypassed, `${method} ${path}`).toEqual({ blocked: null, bypassed: true })
      edge.checkBypass.mockReset()
      // An open shop: nothing changes
      expect(await maintenanceGate(action(), path, site(false), context)).toEqual({
        blocked: null,
        bypassed: false,
      })
    }
  })

  it("takes a card provider's returning POST, and every GET and HEAD an open path had", async () => {
    for (const path of ["/odeme/sonuc", "/odeme/sonuc/hata"]) {
      const gate = await maintenanceGate(
        request(path, { method: "POST" }),
        path,
        site(true),
        context
      )
      expect(gate).toEqual({ blocked: null, bypassed: false })
    }
    for (const method of ["GET", "HEAD"]) {
      for (const path of ["/odeme/durum", "/odeme/sonuc/hata", "/bakim/gir", "/sozlesmeler/kvkk"]) {
        const gate = await maintenanceGate(request(path, { method }), path, site(true), context)
        expect(gate, `${method} ${path}`).toEqual({ blocked: null, bypassed: false })
      }
    }
    expect(edge.checkBypass).not.toHaveBeenCalled()
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
