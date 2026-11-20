import { describe, expect, it } from "vitest"
import {
  CONTACT_SWITCHES,
  CONTENT_PAGE_SECTION_TYPES,
  PAGE_LAYOUT_LIMITS,
  PAGE_ONLY_TYPES,
  contactSwitchOf,
  isPageOnlyType,
} from "../store/section-pages.js"

describe("content pages' sections (adr/0073 Ek 2026-11-19 (2))", () => {
  it("takes the page's own text sections beside the home page's types", () => {
    expect(CONTENT_PAGE_SECTION_TYPES).toContain("rich_text")
    for (const type of PAGE_ONLY_TYPES) {
      expect(CONTENT_PAGE_SECTION_TYPES).toContain(type)
    }
    expect(CONTENT_PAGE_SECTION_TYPES).not.toContain("hero")
    expect(CONTENT_PAGE_SECTION_TYPES).not.toContain("price_bands")
  })

  it("tells a page's own types, each at most once on a page", () => {
    expect(PAGE_ONLY_TYPES).toEqual(["contact", "payment_facts", "shipping_facts"])
    expect(isPageOnlyType("contact")).toBe(true)
    expect(isPageOnlyType("rich_text")).toBe(false)
  })

  it("lays out fifty pages of twelve sections at most", () => {
    expect(PAGE_LAYOUT_LIMITS).toEqual({ pages: 50, sections: 12 })
  })

  it("reads the contact section's switches as on unless off", () => {
    expect(CONTACT_SWITCHES).toEqual(["on", "off"])
    expect(contactSwitchOf(undefined)).toBe("on")
    expect(contactSwitchOf("off")).toBe("off")
    expect(contactSwitchOf(false)).toBe("on")
  })
})
