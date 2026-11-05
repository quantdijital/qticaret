import { describe, expect, it, vi } from "vitest"
import { EMPTY_SUMMARY } from "@/features/products/summary-doc"
import { catalogBody } from "./create-product"

vi.mock("@/lib/sdk", () => ({ sdk: {} }))

const written = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

describe("catalogBody", () => {
  it("asks nothing of a physical product without a short description", () => {
    expect(catalogBody({ kind: "physical", summary_doc: EMPTY_SUMMARY })).toBeNull()
    // The editor's empty paragraph, or spaces, say nothing
    const blank = { type: "doc", content: [{ type: "paragraph" }] }
    expect(catalogBody({ kind: "physical", summary_doc: blank })).toBeNull()
    expect(catalogBody({ kind: "physical", summary_doc: written("  ") })).toBeNull()
  })

  it("sends a physical product's short description alone, as written", () => {
    const doc = written("Yıkanmış keten, rahat kesim.")
    expect(catalogBody({ kind: "physical", summary_doc: doc })).toEqual({ summary_doc: doc })
  })

  // F3.2: the kind goes before the product is published; the short description in the same save
  it("sends a digital product's kind and short description in one save", () => {
    expect(catalogBody({ kind: "digital", summary_doc: EMPTY_SUMMARY })).toEqual({
      kind: "digital",
    })
    const doc = written("Bir saatlik görüşme.")
    expect(catalogBody({ kind: "service", summary_doc: doc })).toEqual({
      kind: "service",
      summary_doc: doc,
    })
  })
})
