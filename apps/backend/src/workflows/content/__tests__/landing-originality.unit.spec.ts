import { fingerprint } from "../../../lib/content/originality"
import { subtreeIn } from "../landing-facet"
import type { CategoryRow } from "../landing-facet"
import { liveAtOf, shareAmong } from "../landing-originality"
import type { MeasuredLanding } from "../landing-originality"

const text = (prefix: string) =>
  Array.from({ length: 320 }, (_, index) => `${prefix}${String(index)}`).join(" ")

const page = (
  id: string,
  body: string,
  status: "draft" | "published",
  liveAt: string | null
): MeasuredLanding => {
  const print = fingerprint(body)
  return {
    id,
    status,
    text_live_at: liveAt,
    fingerprint_size: print.size,
    fingerprint: print.signature,
    originality: 0,
  }
}

describe("landing originality standing", () => {
  const original = page("a", text("ortak"), "published", "2026-10-01T00:00:00Z")
  const copy = page("b", text("ortak"), "published", "2026-10-02T00:00:00Z")
  const shareOf = (row: MeasuredLanding, rows: MeasuredLanding[]) =>
    shareAmong(
      { size: row.fingerprint_size, signature: row.fingerprint as number[] },
      liveAtOf(row),
      row.id,
      rows
    )

  it("keeps the first live text its own and holds the later copy to it", () => {
    expect(shareOf(original, [original, copy])).toBe(100)
    expect(shareOf(copy, [original, copy])).toBe(0)
  })

  it("measures a draft against every live page and against no draft", () => {
    const draft = page("c", text("ortak"), "draft", null)
    expect(liveAtOf(draft)).toBe(Number.POSITIVE_INFINITY)
    expect(shareOf(draft, [original, draft])).toBe(0)
    expect(shareOf(original, [original, draft])).toBe(100)
  })

  it("lets a page taken off the shop count against no other", () => {
    const takenDown = { ...original, status: "draft", text_live_at: null }
    expect(shareOf(copy, [takenDown, copy])).toBe(100)
  })
})

describe("landing category subtree", () => {
  const rows: CategoryRow[] = [
    { id: "root", mpath: "root", is_active: true, is_internal: false },
    { id: "child", mpath: "root.child", is_active: true, is_internal: false },
    { id: "hidden", mpath: "root.hidden", is_active: false, is_internal: false },
    { id: "below", mpath: "root.hidden.below", is_active: true, is_internal: false },
    { id: "internal", mpath: "root.internal", is_active: true, is_internal: true },
    { id: "other", mpath: "other", is_active: true, is_internal: false },
  ]

  it("takes every category below for paths", () => {
    expect(subtreeIn(rows, "root", false).sort()).toEqual(
      ["below", "child", "hidden", "internal", "root"].sort()
    )
  })

  it("takes only the shown ones, each with a shown chain, for products", () => {
    expect(subtreeIn(rows, "root", true).sort()).toEqual(["child", "root"])
  })
})
