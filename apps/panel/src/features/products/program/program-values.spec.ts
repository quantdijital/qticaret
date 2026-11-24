import { describe, expect, it } from "vitest"
import type { Program } from "@/features/products/api/program"
import {
  EMPTY_BODY,
  autoLabelKey,
  newStep,
  programOf,
  programSchema,
  toggledTags,
  valuesOf,
} from "./program-values"

// adr/0078: the Program card's form, read from and written to the server's shape
const BODY = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Vadiler" }] }],
}

const STORED: Program = {
  unit: "day",
  steps: [
    {
      label: "Varış",
      title: "Göreme",
      body: BODY,
      image: { url: "https://cdn.example.com/a.webp", alt: null },
      tags: ["breakfast", "dinner"],
    },
    { label: null, title: "Dönüş", body: null, image: null, tags: [] },
  ],
}

describe("program values", () => {
  it("opens the stored program, an empty label and body as empty fields", () => {
    const values = valuesOf(STORED)
    expect(values.steps[0]).toMatchObject({ label: "Varış", body: BODY })
    expect(values.steps[1]).toMatchObject({ label: "", body: EMPTY_BODY, image: null })
  })

  it("saves what it opened unchanged", () => {
    expect(programOf(valuesOf(STORED))).toEqual(STORED)
  })

  it("sends a blank label or a body without text as none, words trimmed, tags in the list's order", () => {
    const saved = programOf({
      unit: "step",
      steps: [
        {
          label: "   ",
          title: "  Ders 1 ",
          body: { type: "doc", content: [{ type: "paragraph" }] },
          image: null,
          tags: ["transport", "breakfast"],
        },
      ],
    })
    expect(saved).toEqual({
      unit: "step",
      steps: [
        { label: null, title: "Ders 1", body: null, image: null, tags: ["breakfast", "transport"] },
      ],
    })
  })

  it("asks for a title and holds the bounds", () => {
    const result = programSchema.safeParse({ unit: "day", steps: [newStep()] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("products.program.errors.titleRequired")
    const long = { ...newStep(), title: "A", label: "x".repeat(41) }
    expect(programSchema.safeParse({ unit: "day", steps: [long] }).error?.issues[0]?.message).toBe(
      "products.program.errors.labelTooLong"
    )
    const many = Array.from({ length: 31 }, () => ({ ...newStep(), title: "A" }))
    expect(programSchema.safeParse({ unit: "day", steps: many }).error?.issues[0]?.message).toBe(
      "products.program.errors.tooMany"
    )
  })

  it("turns a tag on or off, keeping the list's order", () => {
    expect(toggledTags(["dinner"], "breakfast")).toEqual(["breakfast", "dinner"])
    expect(toggledTags(["breakfast", "dinner"], "dinner")).toEqual(["breakfast"])
  })

  it("names an unlabelled step by the unit", () => {
    expect(autoLabelKey("day")).toBe("products.program.autoDay")
    expect(autoLabelKey("step")).toBe("products.program.autoStep")
  })
})
