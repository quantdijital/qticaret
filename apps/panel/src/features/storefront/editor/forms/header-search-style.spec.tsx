import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
import type { AnySection, HeaderBarSection } from "@/features/storefront/api/layout"
import { switchVariant } from "@/features/storefront/layout/variants"
import { SectionPanel } from "../section-panel"
import { searchSettings } from "../settings-search"
import { openGroup } from "../settings-groups.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

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

/** The bar's panel as the editor holds it: every change kept. */
function renderBar(section: HeaderBarSection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState<AnySection>(section)
    return (
      <SectionPanel
        section={value}
        group="header"
        problems={{}}
        canDuplicate={false}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
        onPlace={vi.fn()}
        onBack={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        badges={[]}
        onBadges={vi.fn()}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
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
  it("offers the box and the icon in İçerik › Arama, the box (the drawing from before) chosen with no reset", async () => {
    const user = userEvent.setup()
    renderBar(centered)
    await openGroup(user, "Arama")
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
    const user = userEvent.setup()
    const changes = renderBar(centered)
    await openGroup(user, "Arama")
    await user.click(screen.getByRole("radio", { name: "Simge, basınca açılır" }))
    expect(changes.at(-1)).toMatchObject({ variant: "centered", search_style: "icon" })
    await user.click(within(stepsOf()).getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ search_style: "field" })
  })

  it("stands over the catalog header's own search settings, kept across variants", async () => {
    const catalog = switchVariant({ ...centered, search_style: "icon" }, "catalog")
    expect(catalog).toMatchObject({ search_style: "icon" })
    expect(switchVariant(catalog, "standard")).toMatchObject({ search_style: "icon" })
    const user = userEvent.setup()
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
    await openGroup(user, "Arama")
    await user.click(within(stepsOf()).getByRole("radio", { name: "Kutu" }))
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

describe("the one-row header's tools", () => {
  it("offers round (today's) and plain on the one-row header only, and saves plain", async () => {
    const user = userEvent.setup()
    const inline = switchVariant(centered, "inline") as HeaderBarSection
    const changes = renderBar(inline)
    await openGroup(user, /Menü/)
    const steps = document.getElementById("mainheader-tools-style")
    if (steps === null) {
      throw new Error("the tools style group is not drawn")
    }
    expect(within(steps).getByRole("radio", { name: "Yuvarlak çerçeveli" })).toBeChecked()
    await user.click(screen.getByRole("radio", { name: "Sade, düğmeli" }))
    expect(changes.at(-1)).toMatchObject({ variant: "inline", tools_style: "plain" })
  })

  it("is not offered on the other headers", () => {
    renderBar(centered)
    expect(document.getElementById("mainheader-tools-style")).toBeNull()
  })
})
