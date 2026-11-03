import { indexStatusOf } from "../sql/status"

describe("the index's status (adr/0056)", () => {
  it("gives numbers and the oldest row's write as ISO 8601", () => {
    expect(
      indexStatusOf({
        documents: "12",
        pending: 3,
        last_rebuilt_at: new Date("2026-11-04T01:10:00.000Z"),
        dictionary_words: "480",
        synonyms: 2,
      })
    ).toEqual({
      documents: 12,
      pending: 3,
      last_rebuilt_at: "2026-11-04T01:10:00.000Z",
      dictionary_words: 480,
      synonyms: 2,
    })
  })

  it("says never for an empty index", () => {
    const empty = {
      documents: 0,
      pending: 0,
      last_rebuilt_at: null,
      dictionary_words: 0,
      synonyms: 0,
    }
    expect(indexStatusOf(empty)).toEqual(empty)
    expect(indexStatusOf(undefined)).toEqual(empty)
  })
})
