import {
  authorLinks,
  authorNameOf,
  bioOf,
  bioParagraphs,
  jobTitleOf,
  linkOf,
} from "../author-rules"

const refused = (run: () => unknown, key: string, field: string) => {
  expect(run).toThrow(expect.objectContaining({ safeMessage: key, field }) as Error)
}

describe("a blog author's fields (adr/0060)", () => {
  it("keeps a clean name and job title, refuses an empty name", () => {
    expect(authorNameOf("  Ayşe   Yılmaz ")).toBe("Ayşe Yılmaz")
    refused(() => authorNameOf("   "), "content.author_name_invalid", "name")
    refused(() => authorNameOf("a".repeat(121)), "content.author_name_invalid", "name")
    expect(jobTitleOf("  ")).toBeNull()
    expect(jobTitleOf(" Bıçak  ustası ")).toBe("Bıçak ustası")
    refused(() => jobTitleOf("x\u0007"), "content.author_job_title_invalid", "job_title")
  })

  it("keeps a bio's paragraphs, one blank line between them", () => {
    const bio = bioOf(" İlk  satır.\r\nAynı paragraf.\n\n\n\nİkinci paragraf. ")
    expect(bio).toBe("İlk satır.\nAynı paragraf.\n\nİkinci paragraf.")
    expect(bioParagraphs(bio)).toEqual(["İlk satır. Aynı paragraf.", "İkinci paragraf."])
    expect(bioOf("  \n ")).toBeNull()
    refused(() => bioOf("a".repeat(2001)), "content.author_bio_invalid", "bio")
  })

  it("takes https links only, a profile on its network's own site", () => {
    expect(linkOf("https://ornek.com.tr/hakkimda", "website_url")).toBe(
      "https://ornek.com.tr/hakkimda"
    )
    expect(linkOf(" ", "website_url")).toBeNull()
    expect(linkOf("https://tr.linkedin.com/in/ayse", "linkedin_url")).toBe(
      "https://tr.linkedin.com/in/ayse"
    )
    expect(linkOf("https://twitter.com/ayse", "x_url")).toBe("https://twitter.com/ayse")
    refused(
      () => linkOf("http://ornek.com", "website_url"),
      "content.author_link_invalid",
      "website_url"
    )
    refused(
      () => linkOf("javascript:alert(1)", "website_url"),
      "content.author_link_invalid",
      "website_url"
    )
    refused(
      () => linkOf("https://user:pw@ornek.com", "website_url"),
      "content.author_link_invalid",
      "website_url"
    )
    refused(
      () => linkOf("https://evil-linkedin.com/in/x", "linkedin_url"),
      "content.author_link_invalid",
      "linkedin_url"
    )
    refused(
      () => linkOf("https://ornek.com/instagram.com", "instagram_url"),
      "content.author_link_invalid",
      "instagram_url"
    )
  })

  it("lists the links in a fixed order, the empty ones left out", () => {
    expect(
      authorLinks({
        website_url: "https://ornek.com/",
        linkedin_url: null,
        instagram_url: "https://www.instagram.com/ayse",
        x_url: "https://x.com/ayse",
      })
    ).toEqual([
      { kind: "website", url: "https://ornek.com/" },
      { kind: "instagram", url: "https://www.instagram.com/ayse" },
      { kind: "x", url: "https://x.com/ayse" },
    ])
  })
})
