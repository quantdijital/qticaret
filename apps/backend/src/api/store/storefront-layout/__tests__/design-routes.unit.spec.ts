import { randomBytes } from "node:crypto"
import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { designPreview, layoutPreview } from "../../../../lib/content/preview-token"
import { storeLayout } from "../../../../workflows/storefront/layout-read"
import { storePageLayout } from "../../../../workflows/storefront/layout-page-read"
import { GET as designRead } from "../design/[token]/route"
import { GET as designPage } from "../design/[token]/pages/[id]/route"

/**
 * adr/0064: a saved look's signed link draws that look (its sections and
 * theme, the draft's shop settings, the live menus), never kept by a cache;
 * a link changed, ended, made for another look or before a rename, or for
 * the draft, opens nothing (404).
 */

const KEY = randomBytes(32)
const SAVED = new Date("2026-11-28T08:00:00Z")
const LOOK = "sfd_01JLOOK"
const LIVE_PAGE = "cnt_01KLIVE00000000000000000"
const DOCUMENT = {
  home: [{ id: "a", type: "hero" }],
  settings: { theme: { preset: "vadi" }, menus: { header: "x" }, trust_badges: [] },
}
const KEPT = { trust_badges: [{ id: "kargo" }], color_swatches: [], low_stock: null }

const rows: Record<string, { id: string; document: unknown; updated_at: Date }> = {
  [LOOK]: { id: LOOK, document: DOCUMENT, updated_at: SAVED },
}

jest.mock("../../../../lib/orders/access-token", () => ({ orderAccessKey: () => KEY }))
jest.mock("../../../../workflows/storefront/layout-row", () => ({
  layouts: () => ({
    listStorefrontDesigns: jest.fn(({ id }: { id: string }) =>
      Promise.resolve(rows[id] ? [rows[id]] : [])
    ),
  }),
}))
jest.mock("../../../../workflows/storefront/design-shared", () => ({
  readable: (stored: unknown) => stored,
}))
jest.mock("../../../../workflows/storefront/design-steps", () => ({
  keptShopSettings: () => Promise.resolve(KEPT),
}))
jest.mock("../../../../lib/storefront/layout-pages-stored", () => ({
  legacyTextAt: () => ({}),
}))
jest.mock("../../../../workflows/storefront/layout-read", () => ({
  storeLayout: jest.fn((_: unknown, doc: { settings: object }) =>
    Promise.resolve({ home: [], settings: { ...doc.settings, menus: [{ id: "drawn" }] } })
  ),
}))
jest.mock("../../../../workflows/storefront/layout-page-read", () => ({
  contentPageOf: (_: unknown, id: string) =>
    Promise.resolve(id === LIVE_PAGE ? { id, live: true } : null),
  storePageLayout: jest.fn(() => Promise.resolve({ page_id: LIVE_PAGE, sections: [] })),
}))

async function call(route: typeof designRead, token: string, id = LIVE_PAGE) {
  const req = {
    params: { token, id },
    scope: {},
    publishable_key_context: { sales_channel_ids: ["sc_1"] },
  } as unknown as MedusaStoreRequest
  const headers: Record<string, string> = {}
  let body: unknown
  const res = {
    setHeader: jest.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value
    }),
    json: jest.fn((value: unknown) => {
      body = value
    }),
  } as unknown as MedusaResponse
  try {
    await route(req, res)
    return { body, headers, error: null as null | { type: string; message: string } }
  } catch (error) {
    return { body, headers, error: error as { type: string; message: string } }
  }
}

const tokenFor = (id = LOOK, savedAt = SAVED, now = new Date()) =>
  designPreview.token(KEY, { id, updated_at: savedAt }, now).token

describe("a saved look's signed link on the storefront", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("draws the look with the draft's shop settings and the live menus, never kept", async () => {
    const answer = await call(designRead, tokenFor())
    expect(answer.error).toBeNull()
    expect(answer.headers["cache-control"]).toBe("private, no-store")
    const drawn = jest.mocked(storeLayout).mock.calls[0]?.[1] as unknown as {
      settings: Record<string, unknown>
      home: unknown
    }
    expect(drawn.home).toEqual(DOCUMENT.home)
    expect(drawn.settings).toMatchObject({ theme: { preset: "vadi" }, ...KEPT, menus: null })
    expect(answer.body).toMatchObject({ layout: { settings: { menus: null } } })
  })

  it.each([
    ["changed", `${tokenFor().slice(0, -2)}AA`],
    ["ended", tokenFor(LOOK, SAVED, new Date(Date.now() - 2 * 60 * 60 * 1000))],
    ["made before a rename", tokenFor(LOOK, new Date("2026-11-27T08:00:00Z"))],
    ["for a removed look", tokenFor("sfd_01JGONE")],
    ["for the draft", layoutPreview.token(KEY, { id: "sfl_01J", updated_at: SAVED }).token],
    ["malformed", "sfd_01JLOOK"],
  ])("opens nothing for a link %s, the answer still never kept", async (_, token) => {
    const answer = await call(designRead, token)
    expect(answer.error?.type).toBe("not_found")
    expect(answer.error?.message).toBe("storefront_layout.preview_unknown")
    expect(answer.headers["cache-control"]).toBe("private, no-store")
    expect(storeLayout).not.toHaveBeenCalled()
  })

  it("gives a live content page its layout in the look, any other page null", async () => {
    const live = await call(designPage, tokenFor())
    expect(live.body).toEqual({ page: { page_id: LIVE_PAGE, sections: [] } })
    expect(jest.mocked(storePageLayout).mock.calls[0]?.[1]).toMatchObject({
      document: { home: DOCUMENT.home },
    })
    const other = await call(designPage, tokenFor(), "cnt_01KDRAFT0000000000000000")
    expect(other.body).toEqual({ page: null })
    const closed = await call(designPage, tokenFor("sfd_01JGONE"))
    expect(closed.error?.type).toBe("not_found")
  })
})
