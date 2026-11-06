import type { SeoPayload } from "@qticaret/types"
import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { pageTitle, pagedPath, pagedSeo } from "../paging"

const HOST = "https://magaza.example"
const ARCHIVE = "/blog/kategori/bakim"

const seoOf = (title: string, canonical: string | null = `${HOST}${ARCHIVE}`): SeoPayload =>
  ({
    title,
    description: "Bakım yazıları.",
    canonical,
    robots: "index,follow",
    openGraph: { title, description: "Bakım yazıları.", url: canonical, siteName: "My L'arte" },
    twitter: { title, description: "Bakım yazıları." },
  }) as unknown as SeoPayload

// docs/13 §3: a list's later page says which page it is, the shop's name last
describe("pageTitle", () => {
  it("leaves the first page as it is", () => {
    expect(pageTitle("Kupalar | My L'arte", 1, "My L'arte", t)).toBe("Kupalar | My L'arte")
  })

  it("puts the page before the shop's name, which stays last and once", () => {
    expect(pageTitle("Kupalar | My L'arte", 2, "My L'arte", t)).toBe(
      "Kupalar – Sayfa 2 | My L'arte"
    )
    // Case and spacing aside, as the backend's withoutRepeatedParts reads the name
    expect(pageTitle("Kupalar - my  l'arte", 3, "My L'arte", t)).toBe(
      "Kupalar – Sayfa 3 - my  l'arte"
    )
    expect(pageTitle("Kupalar | Bardaklar | My L'arte", 2, "My L'arte", t)).toBe(
      "Kupalar | Bardaklar – Sayfa 2 | My L'arte"
    )
  })

  it("adds the page at the end of a title that does not end with the shop's name", () => {
    expect(pageTitle("My L'arte | Kupalar", 2, "My L'arte", t)).toBe(
      "My L'arte | Kupalar – Sayfa 2"
    )
    expect(pageTitle("Kupalar", 2, "", t)).toBe("Kupalar – Sayfa 2")
    // A hyphen inside a word joins nothing
    expect(pageTitle("Çakı N690-Böhler", 2, "Böhler", t)).toBe("Çakı N690-Böhler – Sayfa 2")
  })

  it("cuts a long title at a word so the page and the shop's name stay within 60", () => {
    const title = "El Yapımı Mutfak Bıçakları Modelleri ve Fiyatları | My L'arte"
    const paged = pageTitle(title, 12, "My L'arte", t)
    expect(paged).toBe("El Yapımı Mutfak Bıçakları Modelleri… – Sayfa 12 | My L'arte")
    expect(pageTitle(title, 2, "My L'arte", t)).toBe(
      "El Yapımı Mutfak Bıçakları Modelleri… – Sayfa 2 | My L'arte"
    )
    expect(Array.from(paged).length).toBeLessThanOrEqual(60)
    // One that fits is not cut
    expect(pageTitle("Bıçak Modelleri ve Fiyatları | My L'arte", 2, "My L'arte", t)).toBe(
      "Bıçak Modelleri ve Fiyatları – Sayfa 2 | My L'arte"
    )
    // A single word with no room is kept whole rather than cut mid-word
    const word = "Ç".repeat(70)
    expect(pageTitle(`${word} | My L'arte`, 2, "My L'arte", t)).toBe(
      `${word} – Sayfa 2 | My L'arte`
    )
  })
})

describe("pagedSeo", () => {
  it("titles a later page and names its own address canonical", () => {
    const seo = seoOf("Bakım | My L'arte")
    expect(pagedSeo(seo, 1, t, ARCHIVE)).toBe(seo)
    const second = pagedSeo(seo, 2, t, ARCHIVE)
    expect(second).toMatchObject({
      title: "Bakım – Sayfa 2 | My L'arte",
      description: "Bakım yazıları.",
      canonical: `${HOST}${ARCHIVE}?sayfa=2`,
      openGraph: { title: "Bakım – Sayfa 2 | My L'arte", url: `${HOST}${ARCHIVE}?sayfa=2` },
      twitter: { title: "Bakım – Sayfa 2 | My L'arte" },
    })
  })

  it("keeps a canonical the shop pointed elsewhere, or one resolve already paged", () => {
    const elsewhere = seoOf("Bakım | My L'arte", `${HOST}/blog`)
    expect(pagedSeo(elsewhere, 2, t, ARCHIVE).canonical).toBe(`${HOST}/blog`)
    const paged = seoOf("Kupalar | My L'arte", `${HOST}/kategori/kupalar?sayfa=2`)
    expect(pagedSeo(paged, 2, t, "/kategori/kupalar").canonical).toBe(
      `${HOST}/kategori/kupalar?sayfa=2`
    )
    // A listing: the canonical is resolve's (a filtered page's is the clean one)
    const clean = seoOf("Kupalar | My L'arte", `${HOST}/kategori/kupalar`)
    const filtered = pagedSeo(clean, 2, t)
    expect(filtered.canonical).toBe(`${HOST}/kategori/kupalar`)
    expect(filtered.openGraph.url).toBe(`${HOST}/kategori/kupalar`)
    expect(filtered.title).toBe("Kupalar – Sayfa 2 | My L'arte")
  })

  it("leaves no canonical when the shop has no host yet", () => {
    expect(pagedSeo(seoOf("Bakım | My L'arte", null), 2, t, ARCHIVE).canonical).toBeNull()
  })

  it("puts ?sayfa= on a list's later pages only", () => {
    expect(pagedPath("/blog", 1)).toBe("/blog")
    expect(pagedPath("/blog", 4)).toBe("/blog?sayfa=4")
  })
})
