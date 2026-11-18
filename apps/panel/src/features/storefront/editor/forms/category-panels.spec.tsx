import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { CATEGORY_PANELS_DEFAULTS } from "@qticaret/types"
import { i18next } from "@/lib/i18n"
import type { AnySection, CategoriesSection } from "@/features/storefront/api/layout"
import { switchVariant } from "@/features/storefront/layout/variants"
import { searchSettings } from "../settings-search"
import { cardFooterFields } from "./card-field-ids"
import { CategoryCollageFields } from "./category-collage-fields"
import { VariantField } from "./variant-field"
import { VariantSketch } from "./variant-sketches"

const tiles: CategoriesSection = {
  id: "kategoriler",
  type: "categories",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "tiles",
  title: null,
  category_ids: [],
  show_count: false,
  more: null,
}

const panels = (): CategoriesSection => switchVariant<CategoriesSection>(tiles, "panels")

const search = (query: string, section: AnySection) =>
  searchSettings(query, [{ section, group: "home", names: [] }], i18next.t.bind(i18next)).map(
    (hit) => hit.field?.key ?? null
  )

/** The panels' form holding its section, every change kept. */
function renderHeld(section: CategoriesSection) {
  const changes: CategoriesSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return value.variant === "panels" ? (
      <CategoryCollageFields
        section={value}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
      />
    ) : null
  }
  render(<Holder />)
  return changes
}

/** adr/0049 Ek 2026-11-19: the category panels in the panel. */
describe("the category panels' settings", () => {
  it("is offered as the fourth variant with its own name", async () => {
    const picked: string[] = []
    render(
      <VariantField id="v" type="categories" value="tiles" onChange={(next) => picked.push(next)} />
    )
    await userEvent.click(screen.getByRole("radio", { name: /Fotoğraf panoları/ }))
    expect(picked).toEqual(["panels"])
  })

  it("starts from its own defaults and drops them when switched back", () => {
    expect(panels()).toEqual({ ...tiles, variant: "panels", ...CATEGORY_PANELS_DEFAULTS })
    expect(switchVariant({ ...panels(), height: "high" }, "tiles")).toEqual(tiles)
  })

  it("offers the row count only while the lead is off, in the form and the search", async () => {
    const changes = renderHeld(panels())
    expect(screen.queryByRole("radio", { name: "3" })).toBeNull()
    expect(screen.getByText(/solda boydan boya/)).toBeInTheDocument()
    expect(search("bir sıradaki kart", panels())).not.toContain("cards.columns")
    await userEvent.click(screen.getByRole("switch", { name: /İlk kategoriyi öne çıkar/ }))
    expect(changes.at(-1)).toMatchObject({ variant: "panels", lead: "off" })
    await userEvent.click(screen.getByRole("radio", { name: "2" }))
    expect(changes.at(-1)).toMatchObject({ columns: 2 })
    const off = changes.at(-1) as AnySection
    expect(cardFooterFields(off).map((field) => field.key)).toContain("cards.columns")
    expect(search("bir sıradaki kart", off)).toContain("cards.columns")
  })

  it("is found by its everyday words while the section is panels", () => {
    expect(search("öne çıkar", panels())).toContain("cards.lead")
    expect(search("fotoğraf yüksekliği", panels())).toContain("cards.height")
    expect(search("alt kategori", panels())).toContain("cards.links")
  })

  it("draws the panels in the shared frame, nothing past it", () => {
    const { container } = render(<VariantSketch type="categories" variant="panels" />)
    const svg = container.querySelector("svg")
    if (!svg) {
      throw new Error("no sketch drawn")
    }
    expect(svg.getAttribute("viewBox")).toBe("0 0 112 32")
    const n = (rect: Element, name: string) => Number(rect.getAttribute(name) ?? 0)
    for (const rect of svg.querySelectorAll("rect")) {
      expect(n(rect, "x") + n(rect, "width")).toBeLessThanOrEqual(112)
      expect(n(rect, "y") + n(rect, "height")).toBeLessThanOrEqual(32)
    }
  })
})
