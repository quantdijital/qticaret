import {
  LEVEL,
  MAX_TYPOS,
  leastSimilarity,
  rootCandidates,
  searchPlan,
  typosCouldHelp,
  unitPlan,
  wordsToAnalyse,
} from "../levels"
import type { WordFacts } from "../levels"
import { readQuery, synonymMap } from "../query"

const facts = (entries: Record<string, Partial<WordFacts>>) =>
  new Map(
    Object.entries(entries).map(([word, own]) => [
      word,
      { stem: null, roots: [], alike: [], display: null, ...own },
    ])
  )

// The query's first unit; a query read into none is a broken test
function firstUnit(query: string, synonyms?: Parameters<typeof readQuery>[1]) {
  const unit = readQuery(query, synonyms).units[0]
  if (!unit) {
    throw new Error(`no unit in ${query}`)
  }
  return unit
}

const alike = (word: string, similarity: number, titles = 1) => ({
  word,
  display: word,
  similarity,
  titles,
})

describe("how a query unit is found and weighed (adr/0056)", () => {
  it("weighs the word over its stem, its start and a word it starts with", () => {
    const known = facts({ bicaklar: { stem: "bicak", roots: ["bicak"] } })
    const plan = unitPlan(firstUnit("bıçaklar"), known, false)
    expect(plan.ranks).toEqual([
      { query: "'bicaklar'", weight: LEVEL.exact },
      { query: "'~bicak'", weight: LEVEL.stem },
      { query: "'bicaklar':*", weight: LEVEL.prefix },
      { query: "'bicak'", weight: LEVEL.root },
    ])
    expect(plan.match).toBe("('bicaklar' | '~bicak' | 'bicaklar':* | 'bicak')")
  })

  it("takes typos only when asked, the closest few, weighed by how alike", () => {
    const read = readQuery("bical")
    const known = facts({
      bical: {
        alike: [
          alike("bical", 1),
          alike("bicak", 0.5),
          alike("bicagi", 0.44),
          alike("a1", 0.3),
          alike("a2", 0.3),
          alike("a3", 0.3),
          alike("uzak", 0.2),
        ],
      },
    })
    expect(unitPlan(firstUnit("bical"), known, false).ranks.map((rank) => rank.query)).toEqual([
      "'bical'",
      "'bical':*",
    ])
    const typos = unitPlan(firstUnit("bical"), known, true).ranks.slice(2)
    expect(typos).toHaveLength(MAX_TYPOS)
    expect(typos[0]).toEqual({ query: "'bicak'", weight: LEVEL.typo * 0.5 })
    expect(typosCouldHelp(read, known)).toBe(true)
    expect(typosCouldHelp(read, facts({ bical: { alike: [alike("bical", 1)] } }))).toBe(false)
  })

  it("reads a code as written: no stem, no root, no typo", () => {
    expect(leastSimilarity("model12")).toBeNull()
    expect(leastSimilarity("ku")).toBeNull()
    expect(leastSimilarity("kupa")).toBeCloseTo(1 / 3)
    expect(leastSimilarity("bicak")).toBe(0.25)
    expect(rootCandidates("model123")).toEqual([])
    expect(rootCandidates("kupalar")).toEqual(["kupala", "kupal", "kupa"])
    expect(rootCandidates("kupa")).toEqual([])
    const plan = unitPlan(
      firstUnit("model123"),
      facts({ model123: { stem: "model123", alike: [alike("model124", 0.6)] } }),
      true
    )
    expect(plan.ranks.map((rank) => rank.query)).toEqual(["'model123'", "'model123':*"])
  })

  it("finds a unit by any of its synonyms, a phrase by its words side by side", () => {
    const synonyms = synonymMap([["tişört", "t shirt"]])
    const read = readQuery("tişört", synonyms)
    const plan = unitPlan(firstUnit("tişört", synonyms), facts({ tisort: {} }), false)
    // A phrase is weighed per word: two words found together outweigh one in `ts_rank`
    expect(plan.ranks).toContainEqual({ query: "('t' <-> 'shirt')", weight: LEVEL.synonym / 2 })

    const phrase = unitPlan(
      firstUnit("t shirt", synonyms),
      facts({ shirt: { stem: "shirt" } }),
      false
    )
    expect(phrase.ranks).toEqual([
      { query: "('t' & ('shirt' | '~shirt'))", weight: LEVEL.exact / 2 },
      { query: "'tisort'", weight: LEVEL.synonym },
    ])
    expect(wordsToAnalyse(read)).toEqual([{ norm: "tisort", display: "tişört" }])
  })

  it("asks a query of three for all but one of its units", () => {
    const plan = searchPlan(readQuery("a b c"), facts({}), false)
    expect(plan?.units).toHaveLength(3)
    expect(plan?.match.startsWith("((")).toBe(true)
    expect(searchPlan(readQuery("?!"), facts({}), false)).toBeNull()
  })
})
