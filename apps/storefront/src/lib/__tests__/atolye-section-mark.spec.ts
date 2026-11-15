import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView } from "@qticaret/ui"
import { sectionMark } from "@qticaret/ui"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The section mark in Atölye (adr/0065 §4, 1.1): every section the page
 * shows resolves to exactly one element carrying `data-qs="<id>"`, the
 * header and footer included; the theme editor scrolls to it.
 */

const faq = (id: string, look?: HomeSectionView["look"]): HomeSectionView => ({
  id,
  type: "faq",
  title: "Sorular",
  items: [{ question: "Kargo ne zaman?", answer: "Aynı gün." }],
  ...(look ? { look } : {}),
})

const help: HomeSectionView = {
  id: "yardim1",
  type: "help",
  title: "Yardım",
  contact: { phone: null, email: "destek@example.com", whatsapp: null },
} as unknown as HomeSectionView

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const count = (html: string, id: string) => html.split(`data-qs="${id}"`).length - 1

describe("the section mark in Atölye", () => {
  it("gives the contract's attribute, none without an id", () => {
    expect(sectionMark("abc123")).toEqual({ "data-qs": "abc123" })
    expect(sectionMark(undefined)).toEqual({})
    expect(sectionMark("")).toEqual({})
  })

  it("boxes a section without a look too, once, and keeps its look's box marked", () => {
    const plain = home([faq("sss111")])
    expect(count(plain, "sss111")).toBe(1)
    expect(plain).not.toContain("gf-look")
    const looked = home([faq("sss222", { ground: "well" })])
    expect(count(looked, "sss222")).toBe(1)
    expect(looked).toMatch(/<div class="[^"]*gf-look[^"]*"[^>]*data-qs="sss222"/)
  })

  it("marks the help drawn beside the FAQ on its own element", () => {
    const html = home([faq("sss333"), help])
    expect(count(html, "sss333")).toBe(1)
    expect(count(html, "yardim1")).toBe(1)
  })

  it("marks the header and the footer with their design ids", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        headerBar: { id: "mainheader", variant: "standard", sticky: true },
        footerBar: { id: "mainfooter", variant: "ledger", social: "text" },
      } as never)
    )
    expect(html).toMatch(/<header[^>]*data-qs="mainheader"/)
    expect(html).toMatch(/<footer[^>]*data-qs="mainfooter"/)
    expect(count(html, "mainheader")).toBe(1)
  })
})
