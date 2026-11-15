import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import type { HeaderBarSection } from "@/features/storefront/api/layout"
import { switchVariant } from "@/features/storefront/layout/variants"
import { searchSettings } from "../settings-search"
import { HeaderBarForm } from "./header-bar-form"

const centered: HeaderBarSection = {
  id: "mainheader",
  type: "header_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "centered",
  sticky: true,
  menu_images: "submenus",
  search_style: "field",
}

function renderBar(section: HeaderBarSection) {
  const changes: HeaderBarSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <HeaderBarForm
        section={value}
        problems={{}}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
      />
    )
  }
  render(<Holder />)
  return changes
}

const stepsOf = () => {
  const group = document.getElementById("mainheader-search-style")
  if (!group) {
    throw new Error("no search look")
  }
  return group
}

/** adr/0049 Ek 2026-11-15: the header search as a box or as an icon that opens it. */
describe("the header search's look", () => {
  it("offers the box and the icon, the box (the drawing from before) chosen with no reset", () => {
    renderBar(centered)
    const steps = stepsOf()
    expect(within(steps).getByText("Arama görünümü")).toBeInTheDocument()
    expect(within(steps).getByText("search")).toBeInTheDocument()
    expect(
      within(steps)
        .getAllByRole("radio")
        .map((each) => each.textContent)
    ).toEqual(["Kutu", "Simge, basınca açılır"])
    expect(within(steps).getByRole("radio", { name: "Kutu" })).toBeChecked()
    expect(within(steps).queryByRole("button", { name: /Varsayılana dön/ })).toBeNull()
  })

  it("picks the icon and goes back to the box", async () => {
    const changes = renderBar(centered)
    await userEvent.click(screen.getByRole("radio", { name: "Simge, basınca açılır" }))
    expect(changes.at(-1)).toMatchObject({ variant: "centered", search_style: "icon" })
    await userEvent.click(within(stepsOf()).getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ search_style: "field" })
  })

  it("stands over the catalog header's own search settings, kept across variants", async () => {
    const catalog = switchVariant({ ...centered, search_style: "icon" }, "catalog")
    expect(catalog).toMatchObject({ search_style: "icon" })
    expect(switchVariant(catalog, "standard")).toMatchObject({ search_style: "icon" })
    const changes = renderBar(catalog)
    const order = [
      ...document.querySelectorAll(
        "#mainheader-search-style, #mainheader-header-search_placeholder, #mainheader-header-search_width"
      ),
    ].map((each) => each.id)
    expect(order).toEqual([
      "mainheader-search-style",
      "mainheader-header-search_placeholder",
      "mainheader-header-search_width",
    ])
    await userEvent.click(within(stepsOf()).getByRole("radio", { name: "Kutu" }))
    expect(changes.at(-1)).toMatchObject({ variant: "catalog", search_style: "field" })
  })

  it("is found by its everyday words, its term and its steps on every variant", () => {
    const t = i18next.t.bind(i18next)
    for (const section of [centered, switchVariant(centered, "catalog")]) {
      const keys = (query: string) =>
        searchSettings(query, [{ section, group: "header", names: [] }], t).map(
          (hit) => hit.field?.key ?? null
        )
      expect(keys("arama görünümü")).toEqual(["search_style"])
      expect(keys("simge")).toContain("search_style")
    }
  })
})
