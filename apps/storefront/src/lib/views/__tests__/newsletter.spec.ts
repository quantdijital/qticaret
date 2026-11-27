import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { newsletterLookOf } from "../newsletter"

const PICTURE = {
  url: "https://cdn.example.com/media/bulten.jpg",
  alt: null,
  width: 1200,
  height: 900,
  derivatives: null,
}

describe("the newsletter box's look (adr/0049 Ek 2026-11-17 e-bülten)", () => {
  it("reads a box from before the variants as today's, no line, no promise, no picture", () => {
    expect(newsletterLookOf({}, t, "page")).toEqual({
      variant: "standard",
      description: null,
      note: null,
      image: null,
      tone: "plain",
    })
  })

  it("fills the storefront's line and promise on the split band, the shop's words first", () => {
    expect(newsletterLookOf({ variant: "split" }, t, "page")).toEqual({
      variant: "split",
      description: t("newsletter.description"),
      note: t("newsletter.note"),
      image: null,
      tone: "plain",
    })
    expect(
      newsletterLookOf(
        { variant: "split", description: "Kendi satırım", note: "Haftada bir" },
        t,
        "footer"
      )
    ).toMatchObject({ description: "Kendi satırım", note: "Haftada bir" })
    expect(newsletterLookOf({ variant: "split", show_note: false }, t, "page").note).toBeNull()
  })

  it("keeps the picture on the picture card only, and the promise off the strip", () => {
    expect(newsletterLookOf({ variant: "image_card", image: PICTURE }, t, "page").image).toEqual(
      expect.objectContaining({ src: PICTURE.url, alt: "" })
    )
    expect(newsletterLookOf({ variant: "split", image: PICTURE }, t, "page").image).toBeNull()
    expect(newsletterLookOf({ variant: "strip", note: "Ayda bir" }, t, "page").note).toBeNull()
  })

  it("washes a band in the main colour on `tint` only, never the standard or column box", () => {
    expect(newsletterLookOf({ variant: "strip", tone: "tint" }, t, "footer").tone).toBe("tint")
    expect(newsletterLookOf({ variant: "split", tone: "tint" }, t, "page").tone).toBe("tint")
    expect(newsletterLookOf({ variant: "strip" }, t, "page").tone).toBe("plain")
    expect(newsletterLookOf({ tone: "tint" }, t, "page").tone).toBe("plain")
    expect(newsletterLookOf({ variant: "in_footer", tone: "tint" }, t, "footer").tone).toBe("plain")
    expect(newsletterLookOf({ variant: "strip", tone: "neon" as never }, t, "page").tone).toBe(
      "plain"
    )
  })

  it("reads the footer column variant as today's on a page, as itself in the footer", () => {
    expect(newsletterLookOf({ variant: "in_footer" }, t, "page").variant).toBe("standard")
    expect(newsletterLookOf({ variant: "in_footer" }, t, "footer").variant).toBe("in_footer")
    expect(newsletterLookOf({ variant: "bento" as never }, t, "footer").variant).toBe("standard")
  })
})
