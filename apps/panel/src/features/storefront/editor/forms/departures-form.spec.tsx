import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection, DeparturesSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { HOME_TYPES, PAGE_TYPES, newHomeSection } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { openGroup } from "../settings-groups.fixtures"
import { contentFields } from "./content-registry"
import { FIELD_IDS } from "./field-registry"
import { previewField } from "./preview-fields"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const ID = "kalkislar01"

/** The section's panel as the editor holds it: every change kept. */
function renderPanel(section: AnySection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group="home"
        problems={sectionProblems(value)}
        canDuplicate
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

const fresh = () => newHomeSection("departures", ID) as DeparturesSection

/** adr/0077 §10: the first flagged section, on the home page and the content pages. */
describe("upcoming departures in the editor", () => {
  it("is a home and content page type, new with every dated product, six and the list", () => {
    expect(HOME_TYPES).toContain("departures")
    expect(PAGE_TYPES).toContain("departures")
    expect(fresh()).toMatchObject({
      title: null,
      intro: null,
      source: { kind: "all" },
      limit: 6,
      layout: "list",
    })
    expect(sectionProblems(fresh())).toEqual({})
  })

  it("asks for a category once its products are chosen as the source", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(fresh())

    expect(screen.getByPlaceholderText("Yaklaşan kalkışlar")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Giriş"), "Yakında yola çıkıyoruz")
    await user.click(screen.getByRole("radio", { name: "Bir kategorinin ürünleri" }))

    const last = changes.at(-1) as DeparturesSection
    expect(last).toMatchObject({
      intro: "Yakında yola çıkıyoruz",
      source: { kind: "category", category_id: "" },
    })
    expect(sectionProblems(last)).toEqual({ source: "categoryRequired" })
    await user.click(screen.getByRole("radio", { name: "Bir koleksiyonun ürünleri" }))
    expect(sectionProblems(changes.at(-1) as DeparturesSection)).toEqual({
      source: "collectionRequired",
    })
    await user.click(screen.getByRole("radio", { name: "Tüm tarihli ürünler" }))
    expect(changes.at(-1)).toMatchObject({ source: { kind: "all" } })
  })

  it("offers the list or the cards in Diziliş, set and reset", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(fresh())
    await openGroup(user, "Diziliş")

    const found = document.getElementById(FIELD_IDS.content(ID, "departures_layout"))
    if (!found) throw new Error("no layout field")
    const layout = within(found)
    expect(layout.getByRole("radio", { name: "Liste" })).toHaveAttribute("data-state", "on")
    await user.click(layout.getByRole("radio", { name: "Kartlar" }))
    expect(changes.at(-1)).toMatchObject({ layout: "cards" })
    await user.click(layout.getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ layout: "list" })
    // The phone row is the cards' alone
    expect(document.getElementById(FIELD_IDS.content(ID, "departures_phone"))).toBeNull()
  })

  it("offers the cards stacked or swiped on a phone, set and reset", async () => {
    const user = userEvent.setup()
    const changes = renderPanel({ ...fresh(), layout: "cards" })
    await openGroup(user, "Diziliş")

    const found = document.getElementById(FIELD_IDS.content(ID, "departures_phone"))
    if (!found) throw new Error("no phone field")
    const phone = within(found)
    expect(phone.getByRole("radio", { name: "Alt alta" })).toHaveAttribute("data-state", "on")
    await user.click(phone.getByRole("radio", { name: "Yana kaydır" }))
    expect(changes.at(-1)).toMatchObject({ phone: "scroll" })
    await user.click(phone.getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ phone: "stack" })
    expect(contentFields({ ...fresh(), layout: "cards" }).map((each) => each.key)).toEqual([
      "limit",
      "departures_layout",
      "departures_phone",
    ])
  })

  it("is found by its count and layout in the settings search; its marks lead to fields", () => {
    expect(contentFields(fresh()).map((each) => [each.key, each.group])).toEqual([
      ["limit", "content"],
      ["departures_layout", "layout"],
    ])
    expect(previewField(fresh(), "title")?.target).toBe(`${ID}-title`)
    expect(previewField(fresh(), "intro")?.target).toBe(`${ID}-intro`)
  })
})
