import { bodySections, layoutDocument } from "../layout"
import { LAYOUT_LIMITS } from "../layout-fields"

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const richText = (id: string) => ({
  id,
  type: "rich_text",
  title: null,
  body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Biz" }] }] },
})
const badges = (id: string) => ({ id, type: "trust_badges", variant: "lined" })
const strip = (id: string) => ({ id, type: "marquee", items: [{ text: "Kargo bedava" }] })
const box = (id: string, variant = "standard") => ({
  id,
  type: "newsletter",
  title: null,
  text: null,
  variant,
})
const bar = (variant = "ledger") => ({ id: "mainfooter", type: "footer_bar", variant })
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the footer group (adr/0070 §4)", () => {
  it("takes a rich text, trust badges and a strip beside the box and the bar, as a page's", () => {
    const doc = layoutDocument.parse({
      footer: [strip("altkayan01"), richText("altmetin01"), badges("altguven01"), box("altbulten")],
    })

    expect(LAYOUT_LIMITS.footer).toBe(5)
    expect(doc.footer.map((section) => section.type)).toEqual([
      "marquee",
      "rich_text",
      "trust_badges",
      "newsletter",
    ])
    // The page sections' schema: a look and a device of their own, their defaults filled
    expect(doc.footer[0]).toMatchObject({ ...ALWAYS, device: "all" })
    expect(issues({ footer: [{ ...strip("altkayan01"), look: { width: "full" } }] })).toEqual([])
  })

  it("holds each type once", () => {
    expect(issues({ footer: [richText("altmetin01"), richText("altmetin02")] })).toEqual([
      "storefront_layout.section_duplicate",
    ])
    expect(issues({ footer: [strip("altkayan01"), strip("altkayan02")] })).toContain(
      "storefront_layout.section_duplicate"
    )
  })

  it("takes no picture section nor another page's type", () => {
    const banner = { id: "altbanner1", type: "banner", slides: [] }
    expect(issues({ footer: [banner] })).toEqual(["storefront_layout.section_invalid"])
    expect(issues({ footer: [{ id: "altsss0001", type: "faq", items: [] }] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("holds five sections at most", () => {
    const full = [bar(), box("altbulten"), richText("altmetin01"), badges("altguven01")]
    expect(issues({ footer: [...full, strip("altkayan01")] })).toEqual([])
    const six = layoutDocument.safeParse({
      footer: [...full, strip("altkayan01"), strip("altkayan02")],
    })
    expect(six.error?.issues.map((issue) => issue.code)).toEqual(["too_big"])
  })

  it("counts its strip on every page, as the header's (adr/0049 Ek 2026-11-14 §4.1)", () => {
    expect(issues({ header: [strip("ustkayan01")], footer: [strip("altkayan01")] })).toEqual([])
    expect(
      issues({ footer: [strip("altkayan01")], home: [strip("anakayan1"), strip("anakayan2")] })
    ).toEqual(["storefront_layout.marquee_limit"])
    // A hidden one counts too: a campaign's may come on beside the others
    expect(
      issues({
        header: [strip("ustkayan01")],
        footer: [{ ...strip("altkayan01"), visible: false }],
        category: [{ ...strip("katkayan01"), placement: "top" }],
      })
    ).toEqual(["storefront_layout.marquee_limit"])
  })

  it("keeps a visible in_footer box out of the free rows footer", () => {
    expect(issues({ footer: [bar("free_rows"), box("altbulten", "in_footer")] })).toContain(
      "storefront_layout.section_invalid"
    )
    expect(issues({ footer: [bar("free_rows"), box("altbulten", "split")] })).toEqual([])
  })

  it("checks and shows its rich text, badges and strip with the pages' body sections", () => {
    const doc = layoutDocument.parse({
      home: [richText("anametin01")],
      footer: [box("altbulten"), strip("altkayan01"), richText("altmetin01")],
    })

    expect(bodySections(doc).map((section) => section.id)).toEqual([
      "anametin01",
      "altkayan01",
      "altmetin01",
    ])
  })
})
