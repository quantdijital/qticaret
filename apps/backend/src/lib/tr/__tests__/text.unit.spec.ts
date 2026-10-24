import { trMatchKey, trNeighborhoodMatchKey, trSortKey } from "../text"

describe("trMatchKey", () => {
  it.each([
    ["istanbul", "İSTANBUL"],
    ["  İstanbul  ", "İSTANBUL"],
    ["ığdır", "IĞDIR"],
    ["Kadıköy", "KADIKÖY"],
    ["Yeni   Mahalle", "YENİ MAHALLE"],
  ])("maps %p to %p using Turkish casing", (input, expected) => {
    expect(trMatchKey(input)).toBe(expected)
  })

  it("treats composed and decomposed characters alike", () => {
    expect(trMatchKey("Çankaya".normalize("NFD"))).toBe(trMatchKey("Çankaya"))
  })
})

describe("trNeighborhoodMatchKey", () => {
  it.each(["Caferağa", "CAFERAĞA MAH.", "Caferağa Mah", "Caferağa Mahallesi"])(
    "ignores the neighborhood suffix in %p",
    (input) => {
      expect(trNeighborhoodMatchKey(input)).toBe("CAFERAĞA")
    }
  )
})

describe("trSortKey", () => {
  const sortTr = (names: string[]) =>
    [...names].sort((a, b) => (trSortKey(a) < trSortKey(b) ? -1 : 1))

  it("sorts in Turkish alphabetical order", () => {
    expect(
      sortTr(["Şanlıurfa", "Çorum", "Sakarya", "Ceyhan", "Iğdır", "İzmir", "Uşak", "Ünye"])
    ).toEqual(["Ceyhan", "Çorum", "Iğdır", "İzmir", "Sakarya", "Şanlıurfa", "Uşak", "Ünye"])
  })

  it("puts a shorter name before its extensions and digits before letters", () => {
    expect(sortTr(["Akasya", "Ak Saray", "Ak", "1. Bölge"])).toEqual([
      "1. Bölge",
      "Ak",
      "Ak Saray",
      "Akasya",
    ])
  })

  it("is case-insensitive and made of digits only", () => {
    expect(trSortKey("İZMİR")).toBe(trSortKey("izmir"))
    expect(trSortKey("Çağlayan 2. Sokak")).toMatch(/^\d+$/)
  })
})
