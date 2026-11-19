import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { CATEGORY_COLLAGE_DEFAULTS } from "@qticaret/types"
import { i18next } from "@/lib/i18n"
import type { AnySection, CategoriesSection } from "@/features/storefront/api/layout"
import { switchVariant } from "@/features/storefront/layout/variants"
import { searchSettings } from "../settings-search"
import { cardsSetCount } from "./card-field-ids"
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

const collage = (): CategoriesSection => switchVariant<CategoriesSection>(tiles, "collage")

const search = (query: string, section: AnySection) =>
  searchSettings(query, [{ section, group: "home", names: [] }], i18next.t.bind(i18next)).map(
    (hit) => hit.field?.key ?? null
  )

/** The collage's form holding its section, every change kept. */
function renderHeld(section: CategoriesSection) {
  const changes: CategoriesSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return value.variant === "collage" ? (
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

/** adr/0049 Ek 2026-11-15: the category collage in the panel. */
describe("the category collage's settings", () => {
  it("is offered beside the tiles and the linked cards", async () => {
    const picked: string[] = []
    render(
      <VariantField id="v" type="categories" value="tiles" onChange={(next) => picked.push(next)} />
    )
    expect(screen.getAllByRole("radio")).toHaveLength(4)
    await userEvent.click(screen.getByRole("radio", { name: /Fotoğraflı kolaj/ }))
    expect(picked).toEqual(["collage"])
  })

  it("starts a switched section from the defaults and drops them when switched back", () => {
    expect(collage()).toEqual({ ...tiles, variant: "collage", ...CATEGORY_COLLAGE_DEFAULTS })
    expect(switchVariant({ ...collage(), columns: 3 }, "tiles")).toEqual(tiles)
  })

  it("changes the lead, the columns, the phone's columns, the height and the links", async () => {
    const changes = renderHeld(collage())
    const lead = screen.getByRole("switch", { name: /İlk kategoriyi öne çıkar/ })
    expect(lead).toBeChecked()
    await userEvent.click(lead)
    expect(changes.at(-1)).toMatchObject({ lead: "off" })
    await userEvent.click(screen.getByRole("radio", { name: "3" }))
    expect(changes.at(-1)).toMatchObject({ columns: 3 })
    await userEvent.click(screen.getByRole("radio", { name: /2 kart/ }))
    expect(changes.at(-1)).toMatchObject({ columns_mobile: 2 })
    await userEvent.click(screen.getByRole("radio", { name: "Yüksek" }))
    expect(changes.at(-1)).toMatchObject({ height: "high" })
    const links = screen.getByRole("spinbutton", { name: /Alt kategori sayısı/ })
    fireEvent.change(links, { target: { value: "0" } })
    expect(changes.at(-1)).toMatchObject({ links: 0 })
    // Past the most, the most
    fireEvent.change(links, { target: { value: "12" } })
    expect(changes.at(-1)).toMatchObject({ links: 8, lead: "off", columns: 3, height: "high" })
    // Nothing of the collage lives under the look's closed group
    expect(cardsSetCount(changes.at(-1) as AnySection)).toBe(0)
  })

  it("is found by its everyday words and terms only while the section is a collage", () => {
    expect(search("öne çıkar", collage())).toContain("cards.lead")
    expect(search("fotoğraf yüksekliği", collage())).toContain("cards.height")
    expect(search("alt kategori", collage())).toContain("cards.links")
    expect(search("öne çıkar", tiles)).not.toContain("cards.lead")
    expect(search("fotoğraf yüksekliği", tiles)).not.toContain("cards.height")
  })

  it("draws the collage in the shared frame, nothing past it", () => {
    const { container } = render(<VariantSketch type="categories" variant="collage" />)
    const svg = container.querySelector("svg")
    if (!svg) {
      throw new Error("no sketch drawn")
    }
    expect(svg.getAttribute("viewBox")).toBe("0 0 112 32")
    const rects = [...svg.querySelectorAll("rect")]
    expect(rects.length).toBeGreaterThan(0)
    const n = (rect: Element, name: string) => Number(rect.getAttribute(name) ?? 0)
    for (const rect of rects) {
      expect(n(rect, "x")).toBeGreaterThanOrEqual(0)
      expect(n(rect, "y")).toBeGreaterThanOrEqual(0)
      expect(n(rect, "x") + n(rect, "width")).toBeLessThanOrEqual(112)
      expect(n(rect, "y") + n(rect, "height")).toBeLessThanOrEqual(32)
    }
  })
})
