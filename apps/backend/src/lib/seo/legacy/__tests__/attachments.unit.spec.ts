import { attachmentPage } from "../attachments"

describe("WordPress attachment pages (adr/0059 Ek 2026-11-06)", () => {
  it("reads the record an attachment page hangs under", () => {
    expect(attachmentPage("/urun/dokum-tava/tava")).toEqual({
      parent: "/urun/dokum-tava",
      slug: "tava",
    })
    expect(attachmentPage("/tava-bakimi/kapak")).toEqual({ parent: "/tava-bakimi", slug: "kapak" })
    // A parent whose permalink needs it puts WordPress's `attachment` before the slug
    expect(attachmentPage("/tava-bakimi/attachment/kapak")).toEqual({
      parent: "/tava-bakimi",
      slug: "kapak",
    })
    // A child page's attachment, a Turkish slug (paths come decoded)
    expect(attachmentPage("/kurumsal/hakkimizda/çaki")).toEqual({
      parent: "/kurumsal/hakkimizda",
      slug: "çaki",
    })
    // `attachment` alone is a parent's own segment
    expect(attachmentPage("/attachment/kapak")).toEqual({ parent: "/attachment", slug: "kapak" })
  })

  it("has no parent for a top-level path or a slug that is none", () => {
    for (const path of ["/", "/tava", "/urun/x/.hidden", "/urun/x/a.b", "/urun/x/-a"]) {
      expect({ path, page: attachmentPage(path) }).toEqual({ path, page: null })
    }
  })
})
