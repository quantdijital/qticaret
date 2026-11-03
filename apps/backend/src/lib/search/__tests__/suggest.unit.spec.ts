import type { WordFacts } from "../levels"
import { queryTerms } from "../normalize"
import { suggestionCandidates } from "../suggest"

const facts = (entries: Record<string, Partial<WordFacts>>) =>
  new Map(
    Object.entries(entries).map(([word, own]) => [
      word,
      { stem: null, roots: [], alike: [], display: null, ...own },
    ])
  )

const alike = (word: string, display: string, similarity: number, titles = 1) => ({
  word,
  display,
  similarity,
  titles,
})

const words = (query: string, known: string[]) =>
  queryTerms(query).map((word) => ({ ...word, known: known.includes(word.norm) }))

describe("did you mean (adr/0056)", () => {
  it("offers the title words a weak word may have meant, the most alike first", () => {
    const candidates = suggestionCandidates(
      words("bıçal", []),
      facts({
        bical: { alike: [alike("bicak", "bıçak", 0.5), alike("bicagi", "bıçağı", 0.44)] },
      })
    )
    expect(candidates).toEqual([
      { phrase: "bıçak", query: "'bicak'" },
      { phrase: "bıçağı", query: "'bicagi'" },
    ])
  })

  it("keeps a known word as the catalogue writes it and mends the other", () => {
    const candidates = suggestionCandidates(
      words("sef bical", ["sef"]),
      facts({
        sef: { display: "şef" },
        bical: { alike: [alike("bicak", "bıçak", 0.5), alike("bicagi", "bıçağı", 0.44)] },
      })
    )
    // The caller keeps those some product holds: `şef bıçağı`
    expect(candidates.map((each) => each.phrase)).toEqual(["şef bıçak", "şef bıçağı"])
    expect(candidates[1]?.query).toBe("('sef' & 'bicagi')")
  })

  it("offers nothing when every word is the catalogue's own, nor for nothing alike", () => {
    expect(suggestionCandidates(words("bıçak", ["bicak"]), facts({}))).toEqual([])
    expect(suggestionCandidates(words("zzzz", []), facts({ zzzz: {} }))).toEqual([])
    expect(suggestionCandidates([], facts({}))).toEqual([])
  })

  it("leaves out a word only typos match in no title, and one known only by its stem", () => {
    const candidates = suggestionCandidates(
      words("bıçaklar bical", ["bicaklar"]),
      facts({
        // `bıçaklar` is known by its stem: not asked for as itself
        bicaklar: { stem: "bicak" },
        bical: { alike: [alike("bicak", "bıçak", 0.5), alike("bicaz", "bicaz", 0.4, 0)] },
      })
    )
    expect(candidates).toEqual([{ phrase: "bıçaklar bıçak", query: "'bicak'" }])
  })
})
