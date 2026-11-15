import { beforeEach, describe, expect, it, vi } from "vitest"
import { TOKEN, context, request, site } from "./gate-fixtures"

// The backend's answer for a bypass token, as the test sets it
const edge = vi.hoisted(() => ({ checkBypass: vi.fn() }))
vi.mock("../../store-api/edge", () => edge)

const { maintenanceGate } = await import("../gate")

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
    for (const path of ["/robots.txt", "/sitemap.xml", "/odeme/sonuc", "/odeme/durum"]) {
      const gate = await maintenanceGate(request(path), path, site(false, true), context)
      expect(gate).toEqual({ blocked: null, bypassed: false })
    }
  })

  it("takes a write only at a card provider's return (adr/0053 Ek 2026-11-15)", async () => {
    for (const [path, method] of [
      ["/odeme/durum", "POST"],
      ["/odeme/durum/x", "POST"],
      ["/odeme/sonuc/x", "POST"],
      ["/robots.txt", "POST"],
      ["/sitemap.xml", "DELETE"],
      ["/odeme/sonuc", "PUT"],
    ] as const) {
      const gate = await maintenanceGate(
        request(path, { method }),
        path,
        site(false, true),
        context
      )
      expect(gate.blocked?.status, `${method} ${path}`).toBe(503)
    }
    for (const path of ["/odeme/sonuc", "/odeme/sonuc/hata"]) {
      const gate = await maintenanceGate(
        request(path, { method: "POST" }),
        path,
        site(true, true),
        context
      )
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
