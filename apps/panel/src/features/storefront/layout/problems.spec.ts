import { describe, expect, it } from "vitest"
import type { HeroSection, LayoutDocument, ProductsSection } from "@/features/storefront/api/layout"
import { previewAddress } from "./preview-url"
import { documentProblems, sectionProblems } from "./problems"
import { fromLocalInput, toLocalInput } from "./schedule"
import { newAnnouncementBar, newHomeSection } from "./sections"

describe("sectionProblems", () => {
  it("finds what the server would refuse, field by field", () => {
    expect(
      sectionProblems({
        ...newAnnouncementBar("duyurular"),
        lines: ["", "{kargo} bedava", "Tamam"],
      })
    ).toEqual({ "lines.0": "required", "lines.1": "tokenUnknown" })
    expect(
      sectionProblems({
        ...(newHomeSection("hero", "girisbolumu") as HeroSection),
        heading: "x".repeat(91),
        text: "Bize {telefon} ile ulaşın",
        links: [{ kind: "url", url: "https://example.com", label: " " }],
      })
    ).toEqual({ heading: "tooLong", "links.0": "linkLabel" })
    expect(sectionProblems(newHomeSection("banner", "kampanya"))).toEqual({
      slides: "slidesRequired",
    })
  })

  it("asks for what a product source needs, and an end after the start", () => {
    const products = newHomeSection("products", "yeniurunler") as ProductsSection
    expect(sectionProblems(products)).toEqual({})
    expect(sectionProblems({ ...products, source: { kind: "manual", product_ids: [] } })).toEqual({
      source: "productsRequired",
    })
    expect(sectionProblems({ ...products, source: { kind: "category", category_id: "" } })).toEqual(
      { source: "categoryRequired" }
    )
    expect(
      sectionProblems({
        ...products,
        starts_at: "2026-11-20T09:00:00.000Z",
        ends_at: "2026-11-20T09:00:00.000Z",
      })
    ).toEqual({ schedule: "scheduleOrder" })
  })

  it("maps the document's sections with problems by id", () => {
    const doc: LayoutDocument = {
      header: [newAnnouncementBar("duyurular")],
      home: [newHomeSection("hero", "girisbolumu")],
      footer: [],
    }
    expect([...documentProblems(doc).keys()]).toEqual(["duyurular"])
  })
})

describe("schedule fields", () => {
  it("turns a local moment into an ISO one and back", () => {
    const iso = fromLocalInput("2026-11-20T09:30")
    expect(iso).toBe(new Date(2026, 10, 20, 9, 30).toISOString())
    expect(toLocalInput(iso)).toBe("2026-11-20T09:30")
    expect(fromLocalInput("")).toBeNull()
    expect(toLocalInput(null)).toBe("")
    expect(toLocalInput("not a date")).toBe("")
  })
})

describe("previewAddress", () => {
  const preview = { url: "/onizleme/sfl_abc", path: "/onizleme/sfl_abc" }

  it("puts the signed path on the storefront's origin when one is known", () => {
    expect(previewAddress(preview, "http://localhost:8000")).toBe(
      "http://localhost:8000/onizleme/sfl_abc"
    )
  })

  it("uses the server's link when it is absolute, and none when it is not", () => {
    const absolute = { ...preview, url: "https://ornek.com/onizleme/sfl_abc" }
    expect(previewAddress(absolute, null)).toBe("https://ornek.com/onizleme/sfl_abc")
    expect(previewAddress(preview, null)).toBeNull()
  })
})
