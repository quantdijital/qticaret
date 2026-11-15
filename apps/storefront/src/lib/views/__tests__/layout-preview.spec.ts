import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(state.headers) }))
const requests = vi.hoisted(() => ({
  layoutPreview: vi.fn(),
  layoutSession: vi.fn(),
  storefrontLayout: vi.fn(),
  storefrontMenus: vi.fn(),
  storefrontSettings: vi.fn(),
}))
vi.mock("@/lib/store-api/requests", () => requests)

const { currentLayout, layoutPreviewToken, previewLayoutOf } = await import("../layout")

const LINK = `sfl_01ABC.to51q5.${"a".repeat(43)}`
const SESSION = `sfs_${"0a".repeat(16)}.to51q5.${"b".repeat(43)}`
const DRAFT = { id: "draft" }
const LIVE = { id: "live" }

const on = (token: string | null) => {
  state.headers = new Headers(token ? { "x-qt-layout-preview": token } : {})
}

/**
 * The draft a preview address shows (adr/0049, adr/0065 §1): a signed design link's or the
 * theme editor's live session's, which its quick view dialog (`/hizli-bakis`) follows too.
 */
describe("the preview's design", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requests.storefrontLayout.mockResolvedValue(LIVE)
  })

  it("takes both a signed design link's and the live session's token, nothing else", async () => {
    on(LINK)
    expect(await layoutPreviewToken()).toBe(LINK)
    on(SESSION)
    expect(await layoutPreviewToken()).toBe(SESSION)
    on("sfs_short.to51q5.x")
    expect(await layoutPreviewToken()).toBeNull()
    on(null)
    expect(await layoutPreviewToken()).toBeNull()
  })

  it("opens a live session's draft as last saved and a link's draft", async () => {
    requests.layoutSession.mockResolvedValue({ layout: DRAFT, edition: "e1" })
    expect(await previewLayoutOf(SESSION)).toBe(DRAFT)
    expect(requests.layoutSession).toHaveBeenCalledWith(SESSION)
    expect(requests.layoutPreview).not.toHaveBeenCalled()

    requests.layoutPreview.mockResolvedValue(DRAFT)
    expect(await previewLayoutOf(LINK)).toBe(DRAFT)
    expect(requests.layoutPreview).toHaveBeenCalledWith(LINK)
  })

  it("is null for an ended session and falls back to the live design", async () => {
    requests.layoutSession.mockResolvedValue(null)
    expect(await previewLayoutOf(SESSION)).toBeNull()
    on(SESSION)
    expect(await currentLayout()).toBe(LIVE)

    requests.layoutSession.mockResolvedValue({ layout: DRAFT, edition: null })
    expect(await currentLayout()).toBe(DRAFT)
  })
})
