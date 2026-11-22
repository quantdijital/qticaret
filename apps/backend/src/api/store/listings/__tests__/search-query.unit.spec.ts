import { StoreGetListingProducts, StoreGetListingSuggest } from "../validators"

const base = { region_id: "reg_01TEST", currency_code: "try" }

const issueOf = (input: Record<string, unknown>) => {
  const parsed = StoreGetListingProducts.safeParse({ ...base, ...input })
  return parsed.success ? null : parsed.error.issues[0]?.message
}

describe("listing search query", () => {
  it("takes a search's `q`, trimmed, with no `id`", () => {
    const parsed = StoreGetListingProducts.parse({ ...base, type: "search", q: "  Çakı  " })
    expect(parsed).toMatchObject({ type: "search", q: "Çakı", query: "" })
    expect(parsed.id).toBeUndefined()
  })

  // adr/0077 §2: a search by dates or category has no `q`; the route refuses
  // one whose query holds neither (integration-tests/http/dated-search.spec.ts)
  it("leaves a search without `q` to the route", () => {
    const parsed = StoreGetListingProducts.parse({ ...base, type: "search" })
    expect(parsed).toMatchObject({ type: "search", query: "" })
    expect(parsed.q).toBeUndefined()
  })

  it.each([
    ["empty", { q: "" }],
    ["blank", { q: "   " }],
    ["punctuation only", { q: "?!-" }],
    ["too long", { q: "a".repeat(101) }],
    ["a control character", { q: "bıçak\u0000" }],
  ])("refuses a search whose `q` is %s", (_, input) => {
    expect(issueOf({ type: "search", ...input })).not.toBeNull()
  })

  it("still needs another listing's `id`, and no `q` with it", () => {
    expect(issueOf({ type: "all", id: "all" })).toBeNull()
    expect(issueOf({ type: "all" })).toBe("listing.id_required")
    expect(issueOf({ type: "all", id: "all", q: "kupa" })).toBe("listing.search_query_unexpected")
  })
})

describe("live search query", () => {
  const suggestIssue = (input: Record<string, unknown>) => {
    const parsed = StoreGetListingSuggest.safeParse({ ...base, ...input })
    return parsed.success ? null : parsed.error.issues[0]?.message
  }

  it("takes the words typed so far, trimmed", () => {
    expect(StoreGetListingSuggest.parse({ ...base, q: " ça " })).toEqual({ ...base, q: "ça" })
  })

  it.each([
    ["missing", {}],
    ["blank", { q: "  " }],
    ["punctuation only", { q: "?!" }],
    ["too long", { q: "a".repeat(101) }],
    ["a control character", { q: "ça\u0007" }],
    ["a listing's own query", { q: "çakı", query: "sayfa=2" }],
  ])("refuses words that are %s", (_, input) => {
    expect(suggestIssue(input)).not.toBeNull()
  })
})
