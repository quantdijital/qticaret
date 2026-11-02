import { StoreGetListingProducts } from "../validators"

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

  it.each([
    ["missing", {}],
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
