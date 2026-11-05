import { describe, expect, it, vi } from "vitest"
import { catalogBody } from "./create-product"

vi.mock("@/lib/sdk", () => ({ sdk: {} }))

describe("catalogBody", () => {
  it("asks nothing of a physical product without lines", () => {
    expect(catalogBody({ kind: "physical", summary: [] })).toBeNull()
    expect(catalogBody({ kind: "physical", summary: ["", "  "] })).toBeNull()
  })

  it("sends a physical product's lines alone, tidied", () => {
    expect(catalogBody({ kind: "physical", summary: [" Geyik boynuzu  sap", ""] })).toEqual({
      summary: ["Geyik boynuzu sap"],
    })
  })

  // F3.2: the kind goes before the product is published; the lines go in the same save
  it("sends a digital product's kind and lines in one save", () => {
    expect(catalogBody({ kind: "digital", summary: [] })).toEqual({ kind: "digital" })
    expect(catalogBody({ kind: "service", summary: ["Bir saatlik görüşme"] })).toEqual({
      kind: "service",
      summary: ["Bir saatlik görüşme"],
    })
  })
})
