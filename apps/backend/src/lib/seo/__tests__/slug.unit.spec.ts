import { SLUG_MAX_LENGTH, isValidSlug, toSlug } from "../slug"

describe("toSlug", () => {
  it.each([
    ["Turkish lowercase letters", "şef bıçağı", "sef-bicagi"],
    ["Turkish uppercase letters", "ÇAĞDAŞ ÖĞÜT", "cagdas-ogut"],
    ["dotted capital I", "İstanbul", "istanbul"],
    ["ASCII capital I in Turkish text", "IŞIK", "isik"],
    ["circumflex letters", "Kâğıt Hâlâ Lûtfen", "kagit-hala-lutfen"],
    ["numbers and units", "Şef Bıçağı 20 cm", "sef-bicagi-20-cm"],
    ["a model code", "Seri x50", "seri-x50"],
    ["stop words, which stay", "Bıçak ve Masat için Set", "bicak-ve-masat-icin-set"],
    ["repeated spaces", "çift   boşluk", "cift-bosluk"],
    ["punctuation around and inside", "  --Merhaba!!  Dünya--  ", "merhaba-dunya"],
    ["underscores and slashes", "a_b/c\\d", "a-b-c-d"],
    ["emoji", "🔪 Bıçak 🔥", "bicak"],
    ["other accented Latin letters", "Crème Brûlée", "creme-brulee"],
    ["decomposed input", "şef", "sef"],
    ["ligatures from pasted PDF text", "Proﬁl Bıçak", "profil-bicak"],
    ["superscripts", "20 cm²", "20-cm2"],
    ["letters without an ASCII base", "Straße Øre Łódź", "strasse-ore-lodz"],
    ["digits only, an ID-like slug", "2024", ""],
    ["punctuation only", "!!! ??? ---", ""],
    ["emoji only", "🔪🔥", ""],
  ])("handles %s", (_label, input, expected) => {
    expect(toSlug(input)).toBe(expected)
  })

  it("cuts at a word boundary within the length limit", () => {
    const slug = toSlug(`${"kelime ".repeat(20)}son`)

    // Eleven whole words of six letters and their hyphens
    expect(slug).toHaveLength(76)
    expect(slug.split("-").every((word) => word === "kelime")).toBe(true)
  })

  it("keeps a word that ends exactly at the limit", () => {
    expect(toSlug("abcd efgh ijkl", 9)).toBe("abcd-efgh")
  })

  it("cuts hard when a word-boundary cut would leave only digits", () => {
    const slug = toSlug(`2024 ${"x".repeat(100)}`)

    expect(slug).toHaveLength(SLUG_MAX_LENGTH)
    expect(slug.startsWith("2024-x")).toBe(true)
  })

  it("cuts a single long word hard", () => {
    expect(toSlug("a".repeat(100))).toHaveLength(SLUG_MAX_LENGTH)
  })
})

describe("isValidSlug", () => {
  it.each(["sef-bicagi", "20-cm", "x50", "a"])("accepts %s", (slug) => {
    expect(isValidSlug(slug)).toBe(true)
  })

  it.each([
    ["digits only", "2024"],
    ["digits and hyphens only", "2024-2025"],
    ["uppercase", "Sef"],
    ["Turkish letters", "şef"],
    ["a double hyphen", "a--b"],
    ["a leading hyphen", "-a"],
    ["a trailing hyphen", "a-"],
    ["an underscore", "a_b"],
    ["empty", ""],
    ["too long", "a".repeat(SLUG_MAX_LENGTH + 1)],
  ])("refuses %s", (_label, slug) => {
    expect(isValidSlug(slug)).toBe(false)
  })
})
