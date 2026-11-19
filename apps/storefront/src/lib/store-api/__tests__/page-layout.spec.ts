import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "../errors"

const server = vi.hoisted(() => ({ storeGet: vi.fn(), storePublicGet: vi.fn() }))
vi.mock("../server", () => server)

const { previewPageLayout, publishedPageLayout, sessionPage } = await import("../page-layout")

const LINK = `sfl_01ABC.to51q5.${"a".repeat(43)}`
const SESSION = `sfs_${"0a".repeat(16)}.to51q5.${"b".repeat(43)}`
const LAYOUT = { page_id: "cnt_01KABC", sections: [] }

/**
 * A content page's own layout from the Store API (adr/0073 §6): only the
 * live answer is kept for every shopper (`storePublicGet`, keyed by its
 * path); a signed link's and the live session's carry their token and go
 * as the request's own (`storeGet`), never kept.
 */
describe("a content page's layout reads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps the published layout for every shopper, by the page's path", async () => {
    server.storePublicGet.mockResolvedValue({ page: LAYOUT })
    expect(await publishedPageLayout("cnt_01KABC")).toBe(LAYOUT)
    expect(server.storePublicGet).toHaveBeenCalledWith("/store/storefront-layout/pages/cnt_01KABC")
    expect(server.storeGet).not.toHaveBeenCalled()
  })

  it("reads a signed link's and the live session's draft as the request's own", async () => {
    server.storeGet.mockResolvedValueOnce({ page: LAYOUT })
    expect(await previewPageLayout(LINK, "cnt_01KABC")).toBe(LAYOUT)
    expect(server.storeGet).toHaveBeenLastCalledWith(
      `/store/storefront-layout/preview/${LINK}/pages/cnt_01KABC`
    )
    const entry = { id: "cnt_01KABC", kind: "page" }
    server.storeGet.mockResolvedValueOnce({ page: null, entry, edition: "e1" })
    expect(await sessionPage(SESSION, "cnt_01KABC")).toEqual({ page: null, entry })
    expect(server.storeGet).toHaveBeenLastCalledWith(
      `/store/storefront-layout/session/${SESSION}/pages/cnt_01KABC`
    )
    expect(server.storePublicGet).not.toHaveBeenCalled()
  })

  it("is null when the link or the session does not open; any other failure is thrown", async () => {
    server.storeGet.mockRejectedValueOnce(new StoreApiError(404, "not_found", null))
    expect(await previewPageLayout(LINK, "cnt_02KABC")).toBeNull()
    server.storeGet.mockRejectedValueOnce(new StoreApiError(404, "not_found", null))
    expect(await sessionPage(SESSION, "cnt_02KABC")).toBeNull()
    server.storeGet.mockRejectedValueOnce(new StoreApiError(503, null, null))
    await expect(sessionPage(SESSION, "cnt_03KABC")).rejects.toThrow("503")
  })
})
