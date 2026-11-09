import { describe, expect, it, vi } from "vitest"
import { maskCode } from "./gift-cards"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))

describe("a gift card's code in the list", () => {
  it("keeps its word and last group, hiding the rest", () => {
    expect(maskCode("GIFT-ABCD-EFGH-JKLM-NPQR")).toBe("GIFT-••••-••••-••••-NPQR")
    expect(maskCode("YILBASI-2026-AB12-CD34-EF56-GH78")).toBe("YILBASI-••••-••••-••••-••••-GH78")
  })

  it("shows the last four of a code without groups", () => {
    expect(maskCode("ABCDEFGHJKLM")).toBe("••••••••JKLM")
    expect(maskCode("ABC")).toBe("ABC")
  })
})
