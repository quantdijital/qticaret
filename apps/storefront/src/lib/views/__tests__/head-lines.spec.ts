import { describe, expect, it, vi } from "vitest"
import type { HomeSectionView } from "@qticaret/ui"

/** The shop chose an accent face: a note is drawn in it. */
const theme = vi.hoisted(() => ({ noteInHand: vi.fn(() => Promise.resolve(true)) }))
vi.mock("@/lib/views/theme-settings", () => theme)

const { withHeadLines } = await import("@/lib/views/head-lines")

const reviews: HomeSectionView = {
  id: "yorumlar",
  type: "reviews",
  title: "Misafir yorumları",
  reviews: [],
  more: { label: "Tüm yorumlar", path: "/yorumlar" },
}

describe("a section view's heading lines (sahip 2026-11-28)", () => {
  it("adds the upper line and the note in the accent face, once written", async () => {
    const view = await withHeadLines(reviews, {
      type: "reviews",
      eyebrow: " Gezginler anlatıyor ",
      note: "  Sizden gelenler ",
    })
    expect(view).toEqual({
      ...reviews,
      eyebrow: "Gezginler anlatıyor",
      note: { text: "Sizden gelenler", hand: true },
    })
  })

  it("returns the view as it came without them, the face never read", async () => {
    theme.noteInHand.mockClear()
    expect(await withHeadLines(reviews, { type: "reviews" })).toBe(reviews)
    expect(await withHeadLines(reviews, { type: "reviews", eyebrow: " ", note: null })).toBe(
      reviews
    )
    expect(theme.noteInHand).not.toHaveBeenCalled()
  })

  it("leaves a section that does not carry them alone", async () => {
    const faq: HomeSectionView = { id: "sss", type: "faq", title: "Sorular", items: [] }
    expect(await withHeadLines(faq, { type: "faq", eyebrow: "Yardım", note: "Not" })).toBe(faq)
  })
})
