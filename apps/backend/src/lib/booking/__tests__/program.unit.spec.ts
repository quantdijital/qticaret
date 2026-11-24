import path from "node:path"
import {
  PROGRAM_LIMITS,
  PROGRAM_TAGS,
  PROGRAM_UNITS,
  Program,
  programImageUrls,
  programItinerary,
  programOf,
} from "../program"

const paragraph = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

const issues = (value: unknown): string[] => {
  const parsed = Program.safeParse(value)
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
}

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-program.ts"
)

describe("a dated product's program (adr/0078)", () => {
  it("mirrors the contract's tags, units and bounds", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(PROGRAM_TAGS).toEqual(contract["PROGRAM_TAGS"])
    expect(PROGRAM_UNITS).toEqual(contract["PROGRAM_UNITS"])
    expect(PROGRAM_LIMITS).toEqual(contract["PROGRAM_LIMITS"])
  })

  it("reads a step's empty label, body and picture as none, its tags once each in order", () => {
    const parsed = Program.parse({
      steps: [
        {
          label: "  ",
          title: "  Varış  ",
          body: { type: "doc", content: [{ type: "paragraph" }] },
          tags: ["transport", "breakfast", "transport"],
        },
      ],
    })
    expect(parsed).toEqual({
      unit: "day",
      steps: [
        { label: null, title: "Varış", body: null, image: null, tags: ["breakfast", "transport"] },
      ],
    })
  })

  it("keeps a body of paragraphs and lists with links", () => {
    const body = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Rehber",
              marks: [{ type: "link", attrs: { href: "https://ornek.com" } }],
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Müze" }] }],
            },
          ],
        },
      ],
    }
    expect(Program.parse({ unit: "step", steps: [{ title: "A", body }] }).steps[0]?.body).toEqual(
      body
    )
  })

  it("refuses a step without a title, a tag off the list, an unknown field", () => {
    expect(issues({ steps: [{ title: "" }] })).toContain("booking.program_title_required")
    expect(issues({ steps: [{ title: "A", tags: ["spa"] }] })).toContain(
      "booking.program_tag_unknown"
    )
    expect(issues({ steps: [{ title: "A", price: 10 }] })).not.toEqual([])
    expect(issues({ unit: "night", steps: [] })).not.toEqual([])
  })

  it("refuses a heading, a picture or a script link in the body, and a body too long", () => {
    const heading = {
      type: "doc",
      content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "B" }] }],
    }
    const script = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:1" } }] },
          ],
        },
      ],
    }
    const long = paragraph("a".repeat(PROGRAM_LIMITS.bodyChars + 1))
    for (const body of [heading, script, long]) {
      expect(issues({ steps: [{ title: "A", body }] })).not.toEqual([])
    }
    expect(
      issues({ steps: [{ title: "A", body: paragraph("a".repeat(PROGRAM_LIMITS.bodyChars)) }] })
    ).toEqual([])
  })

  it("refuses a title or label too long, or holding control characters", () => {
    expect(issues({ steps: [{ title: "a".repeat(PROGRAM_LIMITS.title + 1) }] })).not.toEqual([])
    expect(
      issues({ steps: [{ title: "A", label: "a".repeat(PROGRAM_LIMITS.label + 1) }] })
    ).not.toEqual([])
    expect(issues({ steps: [{ title: "A\u0000B" }] })).toContain("booking.program_text_invalid")
  })

  it("holds at most thirty steps", () => {
    const steps = (count: number) =>
      Array.from({ length: count }, (_, n) => ({ title: `G${String(n)}` }))
    expect(issues({ steps: steps(PROGRAM_LIMITS.steps) })).toEqual([])
    expect(issues({ steps: steps(PROGRAM_LIMITS.steps + 1) })).toContain("booking.program_too_long")
  })

  it("takes a picture only by an http(s) address or a shop path", () => {
    expect(
      issues({ steps: [{ title: "A", image: { url: "https://cdn.ornek.com/a.jpg" } }] })
    ).toEqual([])
    expect(issues({ steps: [{ title: "A", image: { url: "javascript:alert(1)" } }] })).toContain(
      "booking.program_image_unknown"
    )
    expect(
      issues({ steps: [{ title: "A", image: { url: "https://u:p@cdn.ornek.com/a.jpg" } }] })
    ).toContain("booking.program_image_unknown")
  })

  it("reads a stored program forgivingly: one that no longer reads, or has no steps, is none", () => {
    expect(programOf(null)).toBeNull()
    expect(programOf({ unit: "day", steps: [] })).toBeNull()
    expect(programOf({ unit: "day", steps: [{ title: "" }] })).toBeNull()
    expect(programOf("x")).toBeNull()
    expect(programOf({ unit: "step", steps: [{ title: "A" }] })?.steps).toHaveLength(1)
  })

  it("names its pictures once each and its steps as an itinerary, the text cut short", () => {
    const program = Program.parse({
      steps: [
        {
          title: "A",
          image: { url: "https://cdn.ornek.com/a.jpg" },
          body: paragraph("b ".repeat(400)),
        },
        { title: "B", image: { url: "https://cdn.ornek.com/a.jpg" } },
      ],
    })
    expect(programImageUrls(program)).toEqual(["https://cdn.ornek.com/a.jpg"])
    const itinerary = programItinerary(program)
    expect(itinerary[0]?.name).toBe("A")
    expect((itinerary[0]?.description ?? "").length).toBeLessThanOrEqual(300)
    expect(itinerary[1]).toEqual({ name: "B", description: null })
  })
})
