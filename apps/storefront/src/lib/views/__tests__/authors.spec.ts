import { describe, expect, it } from "vitest"
import type { StoreContentAuthorDetail } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { authorLinks, authorView } from "../authors"

// A blog author as a theme shows them (adr/0060): the post's box and the author's page head
const author = (over: Partial<StoreContentAuthorDetail> = {}): StoreContentAuthorDetail => ({
  id: "cauth_1",
  name: "Ayşe Usta",
  handle: "ayse-usta",
  path: "/blog/yazar/ayse-usta",
  job_title: " Bıçak ustası ",
  bio: "Yirmi yıldır bıçak yapıyor.\n\nAtölyede çeliği o seçer.",
  image_url: "/media/ayse.jpg",
  image_width: 400,
  image_height: 400,
  image_derivatives: null,
  links: [
    { kind: "x", url: "https://x.com/ayse" },
    { kind: "website", url: "https://ayse.example.com" },
    { kind: "linkedin", url: "https://www.linkedin.com/in/ayse" },
  ],
  ...over,
})

describe("authorView", () => {
  it("gives the name, page, title, bio as paragraphs and the photo with the name as its alt", () => {
    const view = authorView(author(), t)
    expect(view).toMatchObject({
      name: "Ayşe Usta",
      path: "/blog/yazar/ayse-usta",
      jobTitle: "Bıçak ustası",
      bio: ["Yirmi yıldır bıçak yapıyor.", "Atölyede çeliği o seçer."],
    })
    expect(view.image).toMatchObject({ src: "/media/ayse.jpg", alt: "Ayşe Usta", width: 400 })
  })

  it("leaves the bio out when asked (a later list page), and a missing photo and title as none", () => {
    const view = authorView(author({ image_url: null, job_title: "" }), t, { bio: false })
    expect(view.bio).toEqual([])
    expect(view.image).toBeNull()
    expect(view.jobTitle).toBeNull()
  })
})

describe("authorLinks", () => {
  it("labels the profiles in a fixed order, whatever the backend's", () => {
    expect(authorLinks(author().links, t)).toEqual([
      { label: "Web sitesi", href: "https://ayse.example.com" },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/ayse" },
      { label: "X", href: "https://x.com/ayse" },
    ])
  })

  it("drops anything that is no web address", () => {
    expect(
      authorLinks(
        [
          { kind: "website", url: "javascript:alert(1)" },
          { kind: "instagram", url: "https://www.instagram.com/ayse" },
        ],
        t
      )
    ).toEqual([{ label: "Instagram", href: "https://www.instagram.com/ayse" }])
  })
})
