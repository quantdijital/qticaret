import { describe, expect, it } from "vitest"
import {
  PAGE_TEXT_SWITCHES,
  RICH_TEXT_PAGE_VARIANTS,
  pageTextSwitchOf,
  richTextOffPages,
  RICH_TEXT_FOOTER_VARIANTS,
  RICH_TEXT_IMAGE_SIDES,
  RICH_TEXT_IMAGE_SIDE_DEFAULT,
  richTextImageSideOf,
  richTextInFooter,
} from "../store/section-rich-text.js"
import { SECTION_VARIANTS, defaultVariant, variantOf } from "../store/section-variants.js"

describe("rich text variants (adr/0073 §3, Görselli metin)", () => {
  it("keeps today's pane first, the default, and reads anything else as it", () => {
    expect(SECTION_VARIANTS.rich_text).toEqual(["pane", "with_image", "article"])
    expect(defaultVariant("rich_text")).toBe("pane")
    expect(variantOf("rich_text", undefined)).toBe("pane")
    expect(variantOf("rich_text", "collage")).toBe("pane")
    expect(variantOf("rich_text", "with_image")).toBe("with_image")
    expect(variantOf("rich_text", "article")).toBe("article")
  })

  it("keeps the page text to the content pages, its switches on by default", () => {
    expect(RICH_TEXT_PAGE_VARIANTS).toEqual(["article"])
    expect(richTextOffPages("article")).toBe(false)
    expect(richTextOffPages("pane")).toBe(true)
    expect(richTextOffPages("with_image")).toBe(true)
    expect(PAGE_TEXT_SWITCHES).toEqual(["auto", "off"])
    expect(pageTextSwitchOf(undefined)).toBe("auto")
    expect(pageTextSwitchOf("yes")).toBe("auto")
    expect(pageTextSwitchOf("off")).toBe("off")
  })

  it("keeps the picture out of the footer group", () => {
    expect(RICH_TEXT_FOOTER_VARIANTS).toEqual(["pane"])
    expect(richTextInFooter("with_image")).toBe(false)
    expect(richTextInFooter("pane")).toBe(true)
  })

  it("puts the picture first by default, reading a side off the list as it", () => {
    expect(RICH_TEXT_IMAGE_SIDES).toEqual(["start", "end"])
    expect(RICH_TEXT_IMAGE_SIDE_DEFAULT).toBe("start")
    expect(richTextImageSideOf(undefined)).toBe("start")
    expect(richTextImageSideOf("left")).toBe("start")
    expect(richTextImageSideOf("end")).toBe("end")
  })
})
