import { describe, expect, it } from "vitest"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { lostReason } from "./lost-reason"

describe("lostReason", () => {
  it("says a section with fields to fill is still empty, before anything else", () => {
    const faq = newHomeSection("faq", "sss")
    expect(lostReason(faq, { own: true, blocked: true })).toBe("incomplete")
  })

  it("says the draft waits on another part's missing fields", () => {
    const hero = newHomeSection("hero", "giris")
    expect(lostReason(hero, { own: false, blocked: true })).toBe("unsaved")
  })

  it("says a shop-filled section has nothing to show, and others were not found", () => {
    expect(lostReason(newHomeSection("reviews", "yorum"), { own: false, blocked: false })).toBe(
      "empty"
    )
    expect(lostReason(newHomeSection("hero", "giris"), { own: false, blocked: false })).toBe(
      "timeout"
    )
  })
})
