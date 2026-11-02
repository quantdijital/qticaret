import { MAX_POST_TAGS, planPostTerms, sendsTerms, termPath } from "../term-rules"
import type { TermRef } from "../term-rules"

const CAT_A: TermRef = { id: "cterm_a", kind: "category" }
const CAT_B: TermRef = { id: "cterm_b", kind: "category" }
const TAG_X: TermRef = { id: "cterm_x", kind: "tag" }
const TAG_Y: TermRef = { id: "cterm_y", kind: "tag" }
const found = new Map([CAT_A, CAT_B, TAG_X, TAG_Y].map((term) => [term.id, term]))

const refusal = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return error as { safeMessage: string; field?: string }
  }
  throw new Error("expected a refusal")
}

describe("a blog post's category and tags (adr/0019 ek 2026-11-03)", () => {
  it("keeps one category: a new one replaces the old, the tags stay", () => {
    const plan = planPostTerms("post", [CAT_A, TAG_X], { category_id: CAT_B.id }, found)
    expect(plan).toEqual({ next: [CAT_B, TAG_X], add: [CAT_B], remove: [CAT_A] })
  })

  it("takes a second category on the books down to the first", () => {
    const plan = planPostTerms("post", [CAT_A, CAT_B, TAG_X], { tag_ids: [TAG_X.id] }, found)
    expect(plan.next).toEqual([CAT_A, TAG_X])
    expect(plan.remove).toEqual([CAT_B])
  })

  it("replaces the tags with the list sent, each once, and clears with null and []", () => {
    const tags = planPostTerms("post", [CAT_A, TAG_X], { tag_ids: [TAG_Y.id, TAG_Y.id] }, found)
    expect(tags).toEqual({ next: [CAT_A, TAG_Y], add: [TAG_Y], remove: [TAG_X] })
    const cleared = planPostTerms("post", [CAT_A, TAG_X], { category_id: null, tag_ids: [] }, found)
    expect(cleared).toEqual({ next: [], add: [], remove: [CAT_A, TAG_X] })
  })

  it("leaves what the save does not name as it was", () => {
    expect(planPostTerms("post", [CAT_A, TAG_X], {}, found)).toEqual({
      next: [CAT_A, TAG_X],
      add: [],
      remove: [],
    })
  })

  it.each([
    ["a tag given as the category", { category_id: TAG_X.id }, "category_id"],
    ["a category among the tags", { tag_ids: [CAT_A.id] }, "tag_ids"],
    ["a term that is not there", { tag_ids: ["cterm_gone"] }, "tag_ids"],
  ])("refuses %s", (_label, input, field) => {
    expect(refusal(() => planPostTerms("post", [], input, found))).toMatchObject({
      safeMessage: "content.term_unknown",
      field,
    })
  })

  it("files only posts: a page may clear terms, not take them", () => {
    expect(
      refusal(() => planPostTerms("page", [], { category_id: CAT_A.id }, found))
    ).toMatchObject({ safeMessage: "content.terms_post_only" })
    expect(refusal(() => planPostTerms("page", [], { tag_ids: [TAG_X.id] }, found))).toMatchObject({
      safeMessage: "content.terms_post_only",
    })
    expect(planPostTerms("page", [], { category_id: null, tag_ids: [] }, found).next).toEqual([])
  })

  it("holds a post to its number of tags", () => {
    const many = Array.from({ length: MAX_POST_TAGS + 1 }, (_, index) => `cterm_${String(index)}`)
    expect(refusal(() => planPostTerms("post", [], { tag_ids: many }, found))).toMatchObject({
      safeMessage: "content.tags_too_many",
    })
  })

  it("says whether a save names terms at all", () => {
    expect(sendsTerms(undefined)).toBe(false)
    expect(sendsTerms({})).toBe(false)
    expect(sendsTerms({ category_id: undefined, tag_ids: undefined })).toBe(false)
    expect(sendsTerms({ category_id: null })).toBe(true)
    expect(sendsTerms({ tag_ids: [] })).toBe(true)
  })

  it("puts a category's archive and a tag's under the blog (docs/13 §2.2)", () => {
    expect(termPath({ kind: "category", handle: "bicak-bakimi" })).toBe(
      "/blog/kategori/bicak-bakimi"
    )
    expect(termPath({ kind: "tag", handle: "paslanmaz-celik" })).toBe(
      "/blog/etiket/paslanmaz-celik"
    )
  })
})
