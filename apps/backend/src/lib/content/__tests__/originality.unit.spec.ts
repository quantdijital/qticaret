import {
  fingerprint,
  keptOutOfSearch,
  landingRobots,
  originality,
  sharedShare,
} from "../originality"

// Distinct words a text is made of, so overlaps are known exactly
const words = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index)}`)

const text = (...parts: string[][]) => parts.flat().join(" ")

describe("landing text originality", () => {
  const base = words("kelime", 400)

  it("finds a copy entirely shared and an unrelated text entirely its own", () => {
    const own = fingerprint(text(base))
    expect(originality(own, [fingerprint(text(base))])).toBe(0)
    expect(originality(own, [fingerprint(text(words("baska", 400)))])).toBe(100)
    expect(originality(own, [])).toBe(100)
  })

  it("estimates a half-copied text close to half", () => {
    const own = fingerprint(text(base))
    const other = fingerprint(text(base.slice(0, 200), words("yeni", 200)))
    const share = sharedShare(own, other)
    // 196 of 396 shingles are shared; the signature estimates within a few points
    expect(share).toBeGreaterThan(0.38)
    expect(share).toBeLessThan(0.62)
  })

  it("sees boilerplate with another name swapped in as mostly the same", () => {
    // A programmatic page: the same 300 words, the place's name in three spots
    const boilerplate = words("ortak", 300)
    const page = (place: string) =>
      text(
        [place],
        boilerplate.slice(0, 100),
        [place],
        boilerplate.slice(100, 200),
        [place],
        boilerplate.slice(200)
      )
    const istanbul = fingerprint(page("İstanbul"))
    expect(originality(istanbul, [fingerprint(page("Ankara"))])).toBeLessThan(30)
  })

  it("reads the page's own names as one placeholder, their suffixes kept", () => {
    // A template whose every sentence names the facet: without the names, one text
    const sentences = (name: string) =>
      Array.from(
        { length: 60 },
        (_, index) => `${name} ürünlerinde ${name}ten yapılmış parça ${String(index)} vardır`
      ).join(". ")
    const seramik = fingerprint(sentences("Seramik"), ["Seramik", "Ev ve Yaşam"])
    const porselen = fingerprint(sentences("Porselen"), ["Porselen", "Ev ve Yaşam"])
    expect(originality(seramik, [porselen])).toBe(0)
    // Unnamed, the swapped words keep the two apart in a share of each run
    expect(
      originality(fingerprint(sentences("Seramik")), [fingerprint(sentences("Porselen"))])
    ).toBeGreaterThan(30)
  })

  it("leaves short names and a name inside another word alone", () => {
    const own = "Ev eşyası seçerken evet demeden önce yerleşik seramik ölçülerine bakın"
    expect(fingerprint(own, ["Ev", "şik"])).toEqual(fingerprint(own))
  })

  it("is the same every time and has nothing to say about an empty text", () => {
    expect(fingerprint(text(base))).toEqual(fingerprint(text(base)))
    expect(fingerprint("")).toEqual({ size: 0, signature: [] })
    expect(originality(fingerprint(""), [fingerprint(text(base))])).toBe(0)
  })
})

describe("landing robots (adr/0019 Ek 2026-11-05)", () => {
  it("keeps a page under 30% out of search, its links followed, and leaves the rest its own", () => {
    expect([keptOutOfSearch(29), keptOutOfSearch(30)]).toEqual([true, false])
    expect(landingRobots(29, null)).toBe("noindex_follow")
    expect(landingRobots(0, "index_follow")).toBe("noindex_follow")
    // A page already shut harder stays so
    expect(landingRobots(10, "noindex_nofollow")).toBe("noindex_nofollow")
    expect(landingRobots(30, null)).toBeNull()
    expect(landingRobots(85, "index_follow")).toBe("index_follow")
    expect(landingRobots(85, "noindex_nofollow")).toBe("noindex_nofollow")
  })
})
