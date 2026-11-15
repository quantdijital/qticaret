import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const requests = vi.hoisted(() => ({ layoutPreview: vi.fn() }))
vi.mock("@/lib/store-api/requests", () => requests)
const layout = vi.hoisted(() => ({ layoutPreviewToken: vi.fn() }))
vi.mock("@/lib/views/layout", () => layout)
const shared = vi.hoisted(() => ({ GET: vi.fn() }))
vi.mock("@/app/api/quick-view/route", () => shared)

const { GET } = await import("../onizleme/[token]/hizli-bakis/route")

const TOKEN = `sfl_01ABC.to51q5.${"a".repeat(43)}`
const ask = () => GET(new Request(`http://localhost:8000/onizleme/${TOKEN}/hizli-bakis?id=prod_01`))

/**
 * The theme editor's preview's quick view (adr/0049 Ek 2026-11-15): `/onizleme/` stays open
 * while the shop is dark (adr/0053), so only a live signed design preview reaches the handler.
 */
describe("the preview's quick view answers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    shared.GET.mockResolvedValue(Response.json({ id: "prod_01" }))
  })

  it("hands a live design preview's request to the shop's handler", async () => {
    layout.layoutPreviewToken.mockResolvedValue(TOKEN)
    requests.layoutPreview.mockResolvedValue({ id: "sfl_01ABC" })
    const response = await ask()
    expect(response.status).toBe(200)
    expect(requests.layoutPreview).toHaveBeenCalledWith(TOKEN)
    expect(shared.GET).toHaveBeenCalledOnce()
  })

  it("is a 404 without a preview token or for one the backend no longer opens", async () => {
    layout.layoutPreviewToken.mockResolvedValue(null)
    const none = await ask()
    expect(none.status).toBe(404)
    expect(none.headers.get("cache-control")).toBe("private, no-store")
    expect(requests.layoutPreview).not.toHaveBeenCalled()

    layout.layoutPreviewToken.mockResolvedValue(TOKEN)
    requests.layoutPreview.mockResolvedValue(null)
    expect((await ask()).status).toBe(404)
    expect(shared.GET).not.toHaveBeenCalled()
  })

  it("is a 502 when the backend cannot say", async () => {
    layout.layoutPreviewToken.mockResolvedValue(TOKEN)
    requests.layoutPreview.mockRejectedValue(new StoreApiError(500, null, null))
    expect((await ask()).status).toBe(502)
    requests.layoutPreview.mockRejectedValue(new StoreApiError(429, null, null))
    expect((await ask()).status).toBe(429)
    expect(shared.GET).not.toHaveBeenCalled()
  })
})
