import { describe, expect, it } from "vitest"
import { drawnVariant } from "../section-variants"

describe("the variant a theme draws (adr/0049 Ek 2026-11-14 §2.3)", () => {
  it("is the section's own when the theme draws it", () => {
    expect(drawnVariant("trust_badges", "lined", ["strip", "lined"])).toBe("lined")
  })

  it("falls back to the type's default for one the theme lacks, or none, or one off the list", () => {
    expect(drawnVariant("trust_badges", "lined", ["strip"])).toBe("strip")
    expect(drawnVariant("trust_badges", undefined, ["strip", "lined"])).toBe("strip")
    expect(drawnVariant("trust_badges", "bento", ["strip", "lined"] as never[])).toBe("strip")
  })
})
