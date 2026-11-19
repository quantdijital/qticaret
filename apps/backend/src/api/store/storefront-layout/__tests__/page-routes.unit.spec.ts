import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import {
  contentPageOf,
  publishedPageLayout,
} from "../../../../workflows/storefront/layout-page-read"
import { GET as livePage } from "../pages/[id]/route"
import { GET as previewPage } from "../preview/[token]/pages/[id]/route"

/**
 * adr/0073 §6, security review 2026-11-19 (S1): the public and the signed
 * design link's per-page reads answer every page not to be seen alike (a
 * draft, a deleted page, a post, a malformed id, none such): the same
 * status and the same body, so neither tells which pages exist.
 */

const LIVE = "cnt_01KLIVE00000000000000000"
const DRAFT = "cnt_01KDRAFT0000000000000000"
const POST = "cnt_01KPOST00000000000000000"
const MISSING = "cnt_01KMISSING00000000000000"
const LAYOUT = { page_id: LIVE, sections: [{ id: "yardim001", type: "help", placement: "top" }] }

jest.mock("../../../../workflows/storefront/layout-page-read", () => ({
  // A post is not a page: the lookup asks for pages only and finds none
  contentPageOf: jest.fn((_: unknown, id: string) =>
    Promise.resolve(id === LIVE ? { id, live: true } : id === DRAFT ? { id, live: false } : null)
  ),
  publishedPageLayout: jest.fn(() => Promise.resolve(LAYOUT)),
  storePageLayout: jest.fn(() => Promise.resolve(LAYOUT)),
}))
jest.mock("../access", () => ({
  previewRow: jest.fn(() => Promise.resolve({ id: "sfl_1", draft: {} })),
}))
jest.mock("../../../../lib/storefront/layout", () => ({
  PAGE_ID: /^cnt_[0-9A-Za-z]{1,40}$/,
  readStoredLayout: jest.fn((doc: unknown) => doc),
}))

async function call(route: typeof livePage, id: string) {
  const req = {
    params: { id, token: "sfl_token" },
    scope: {},
    publishable_key_context: { sales_channel_ids: ["sc_1"] },
  } as unknown as MedusaStoreRequest
  let status = 200
  let body: unknown
  const res = {
    setHeader: jest.fn(),
    vary: jest.fn(),
    status: jest.fn((code: number) => {
      status = code
      return res
    }),
    json: jest.fn((value: unknown) => {
      body = value
    }),
  } as unknown as MedusaResponse
  await route(req, res)
  return { status, body }
}

describe.each([
  ["the live read", livePage],
  ["the signed design link's read", previewPage],
])("%s of a content page's layout", (_, route) => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("gives a live page its layout", async () => {
    expect(await call(route, LIVE)).toEqual({ status: 200, body: { page: LAYOUT } })
  })

  it("answers a draft, a post, a malformed id and no such page alike", async () => {
    const draft = await call(route, DRAFT)
    expect(draft).toEqual({ status: 200, body: { page: null } })
    for (const id of [POST, MISSING, "hakkimizda", "prod_01KX"]) {
      expect(await call(route, id)).toEqual(draft)
    }
    expect(publishedPageLayout).not.toHaveBeenCalled()
    // A malformed id is never looked up
    expect(contentPageOf).not.toHaveBeenCalledWith(expect.anything(), "hakkimizda")
  })
})
