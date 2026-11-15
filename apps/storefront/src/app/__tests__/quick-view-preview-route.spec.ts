import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const layout = vi.hoisted(() => ({ layoutPreviewToken: vi.fn(), previewLayoutOf: vi.fn() }))
vi.mock("@/lib/views/layout", () => layout)
const shared = vi.hoisted(() => ({ GET: vi.fn() }))
vi.mock("@/app/api/quick-view/route", () => shared)

const { GET } = await import("../onizleme/[token]/hizli-bakis/route")

const TOKEN = `sfl_01ABC.to51q5.${"a".repeat(43)}`
const SESSION = `sfs_${"0a".repeat(16)}.to51q5.${"b".repeat(43)}`
const ask = (token = TOKEN) =>
  GET(new Request(`http://localhost:8000/onizleme/${token}/hizli-bakis?id=prod_01`))

/**
 * The theme editor's preview's quick view (adr/0049 Ek 2026-11-15): `/onizleme/` stays open
 * while the shop is dark (adr/0053), so only a live signed design preview (or the editor's live
 * session, adr/0065) reaches the handler.
 */
describe("the preview's quick view answers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    shared.GET.mockResolvedValue(Response.json({ id: "prod_01" }))
  })

  it("hands a live design preview's request to the shop's handler", async () => {
    layout.layoutPreviewToken.mockResolvedValue(TOKEN)
    layout.previewLayoutOf.mockResolvedValue({ id: "sfl_01ABC" })
    const response = await ask()
    expect(response.status).toBe(200)
    expect(layout.previewLayoutOf).toHaveBeenCalledWith(TOKEN)
    expect(shared.GET).toHaveBeenCalledOnce()
  })

  it("hands the theme editor's live session's request to the shop's handler", async () => {
    layout.layoutPreviewToken.mockResolvedValue(SESSION)
    layout.previewLayoutOf.mockResolvedValue({ id: "sfl_01ABC" })
    expect((await ask(SESSION)).status).toBe(200)
    expect(layout.previewLayoutOf).toHaveBeenCalledWith(SESSION)
    expect(shared.GET).toHaveBeenCalledOnce()
  })

  it("is a 404 without a preview token or for one the backend no longer opens", async () => {
    layout.layoutPreviewToken.mockResolvedValue(null)
    const none = await ask()
    expect(none.status).toBe(404)
    expect(none.headers.get("cache-control")).toBe("private, no-store")
    // The 404 is nobody's search result either
    expect(none.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    expect(layout.previewLayoutOf).not.toHaveBeenCalled()

    layout.layoutPreviewToken.mockResolvedValue(TOKEN)
    layout.previewLayoutOf.mockResolvedValue(null)
    const lapsed = await ask()
    expect(lapsed.status).toBe(404)
    expect(lapsed.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    // An ended live session as well
    layout.layoutPreviewToken.mockResolvedValue(SESSION)
    expect((await ask(SESSION)).status).toBe(404)
    expect(shared.GET).not.toHaveBeenCalled()
  })

  it("is a 502 when the backend cannot say", async () => {
    layout.layoutPreviewToken.mockResolvedValue(TOKEN)
    layout.previewLayoutOf.mockRejectedValue(new StoreApiError(500, null, null))
    expect((await ask()).status).toBe(502)
    layout.previewLayoutOf.mockRejectedValue(new StoreApiError(429, null, null))
    expect((await ask()).status).toBe(429)
    expect(shared.GET).not.toHaveBeenCalled()
  })
})
