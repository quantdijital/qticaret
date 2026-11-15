import { beforeEach, describe, expect, it, vi } from "vitest"
import { t } from "@/lib/i18n"

// The request's headers as the proxy set them: the preview's token or none
const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(request.headers) }))
vi.mock("@/lib/store-api/requests", () => ({
  listProducts: vi.fn(),
  pathsOf: vi.fn(),
  priceDisplays: vi.fn(),
  legalIdentity: vi.fn(),
  siteSeo: vi.fn(),
  storefrontSettings: vi.fn(),
}))
vi.mock("@/lib/store-api/extras", () => ({
  cardFacts: vi.fn(() => Promise.resolve({})),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
  latestReviewPhotos: vi.fn(() => Promise.resolve([])),
}))

const { sectionViews } = await import("../sections")
const { isEditorSession } = await import("../layout")

type Section = Parameters<typeof sectionViews>[0][number]

/**
 * The editor's field marks (adr/0065 Faz 2b) are asked for by the views:
 * only the theme editor's live session (`sfs_`) sets `editor`; a shared
 * design link (`sfl_`), a live page and a forged header never do.
 */

const SESSION = `sfs_${"a".repeat(32)}.m1x2.${"b".repeat(43)}`
const LINK = `sfl_abc123.m1x2.${"b".repeat(43)}`

const faq = { id: "sss111", type: "faq", title: null, items: [{ question: "Q?", answer: "A." }] }

const viewsOn = async (token: string | null) => {
  request.headers = new Headers(token ? { "x-qt-layout-preview": token } : {})
  return sectionViews([faq as Section], t)
}

describe("the editor's views", () => {
  beforeEach(() => {
    request.headers = new Headers()
  })

  it("say so in the editor's live session only", async () => {
    const [view] = await viewsOn(SESSION)
    expect(view).toMatchObject({ id: "sss111", editor: true })
    expect(await isEditorSession()).toBe(true)
  })

  it("stay as they were on a live page and a shared design link", async () => {
    for (const token of [null, LINK, "sfs_short", `sfs_${"A".repeat(32)}.m1x2.${"b".repeat(43)}`]) {
      const [view] = await viewsOn(token)
      expect(view).toBeDefined()
      expect(view).not.toHaveProperty("editor")
      expect(await isEditorSession()).toBe(false)
    }
  })
})
