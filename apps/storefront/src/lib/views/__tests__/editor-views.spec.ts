import { beforeEach, describe, expect, it, vi } from "vitest"
import { t } from "@/lib/i18n"

// The request's headers as the proxy set them: the preview's token or none
const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(request.headers) }))
// The backend's sessions: the one open session opens; any other token is a 404 (null)
const sessions = vi.hoisted(() => ({ open: new Set<string>(), asked: [] as string[] }))
vi.mock("@/lib/store-api/requests", () => ({
  layoutSession: vi.fn((token: string) => {
    sessions.asked.push(token)
    return Promise.resolve(sessions.open.has(token) ? { layout: {}, edition: null } : null)
  }),
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
const { isEditorSession, layoutLinks } = await import("../layout")

type Section = Parameters<typeof sectionViews>[0][number]

/**
 * The editor's field marks (adr/0065 Faz 2b) are asked for by the views:
 * only the theme editor's live session (`sfs_`) sets `editor`; a shared
 * design link (`sfl_`), a live page and a forged header never do.
 */

const SESSION = `sfs_${"a".repeat(32)}.m1x2.${"b".repeat(43)}`
// The session's form, but no session the backend knows (a made-up address)
const FORGED = `sfs_${"c".repeat(32)}.m1x2.${"d".repeat(43)}`
const LINK = `sfl_abc123.m1x2.${"b".repeat(43)}`

const faq = { id: "sss111", type: "faq", title: null, items: [{ question: "Q?", answer: "A." }] }

const viewsOn = async (token: string | null) => {
  request.headers = new Headers(token ? { "x-qt-layout-preview": token } : {})
  return sectionViews([faq as Section], t)
}

describe("the editor's views", () => {
  beforeEach(() => {
    request.headers = new Headers()
    sessions.open = new Set([SESSION])
    sessions.asked = []
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
    // Only a token of the session's form is asked about
    expect(sessions.asked).toEqual([])
  })

  it("stay as they were on a session's form that opens none (security review, DÜŞÜK-2)", async () => {
    const [view] = await viewsOn(FORGED)
    expect(view).not.toHaveProperty("editor")
    expect(await isEditorSession()).toBe(false)
    // An ended session too
    sessions.open = new Set()
    const [ended] = await viewsOn(SESSION)
    expect(ended).not.toHaveProperty("editor")
    expect(await isEditorSession()).toBe(false)
  })
})

describe("a section's buttons", () => {
  const link = (label: string | null, path: string | null) => ({
    label,
    kind: "page" as const,
    target: null,
    path,
  })

  it("say nothing more while every link is printed", () => {
    const shown = layoutLinks([link("Bir", "/a"), link("İki", "/b")], t)
    expect(shown).toEqual({
      actions: [
        { label: "Bir", path: "/a" },
        { label: "İki", path: "/b" },
      ],
    })
  })

  it("say their place in the design once a broken one is left out (the field mark)", () => {
    const shown = layoutLinks([link("Silinmiş", null), link("İki", "/b")], t)
    expect(shown).toEqual({ actions: [{ label: "İki", path: "/b" }], actionsAt: [1] })
  })
})
