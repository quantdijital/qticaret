import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection, ProductsSection } from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { tabMates } from "@/features/storefront/layout/shelf-tabs"
import { switchVariant } from "@/features/storefront/layout/variants"
import { SectionPanel } from "../section-panel"
import { FIELD_IDS } from "./field-registry"
import { openGroup } from "../settings-groups.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const rail = (id: string, more: Partial<ProductsSection> = {}): ProductsSection => ({
  ...(newHomeSection("products", id) as ProductsSection),
  ...more,
})

/** A rail's panel as the editor holds it, beside the rails it joins: every change kept. */
function renderPanel(section: ProductsSection, mates: ProductsSection[] = []) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState<AnySection>(section)
    return (
      <SectionPanel
        section={value}
        group="home"
        problems={{}}
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
        shelfMates={mates}
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

describe("which rails share a tabbed shelf (bilesen-denetimi (b) 2)", () => {
  const banner = { ...rail("arabolum01"), type: "faq" } as unknown as AnySection

  it("joins rails standing next to each other, as the theme does", () => {
    const page = [rail("bir0000001"), rail("iki0000001"), banner, rail("uc00000001")]
    expect(tabMates(page, "bir0000001").map((each) => each.id)).toEqual(["iki0000001"])
    expect(tabMates(page, "iki0000001").map((each) => each.id)).toEqual(["bir0000001"])
    expect(tabMates(page, "uc00000001")).toEqual([])
  })

  it("leaves out a rail set apart, a columns rail and a hidden section", () => {
    const apart = [rail("bir0000001"), rail("iki0000001", { tabs: "off" }), rail("uc00000001")]
    expect(tabMates(apart, "bir0000001")).toEqual([])
    expect(tabMates(apart, "iki0000001")).toEqual([])
    const columns = switchVariant(rail("iki0000001"), "columns")
    expect(tabMates([rail("bir0000001"), columns, rail("uc00000001")], "bir0000001")).toEqual([])
    const hidden: AnySection[] = [
      rail("bir0000001"),
      { ...banner, visible: false } as AnySection,
      rail("uc00000001"),
    ]
    expect(tabMates(hidden, "bir0000001").map((each) => each.id)).toEqual(["uc00000001"])
  })
})

describe("the rail's tabs switch", () => {
  it("is on by default, names the rail it joins, and sets the rail apart", async () => {
    const user = userEvent.setup()
    const section = rail("bir0000001")
    const changes = renderPanel(section, [rail("iki0000001", { title: "İndirimdekiler" })])
    await openGroup(user, "Diziliş")
    const box = document.getElementById(FIELD_IDS.shelf(section.id, "tabs"))
    if (!box) throw new Error("the tabs field is not drawn")
    const field = within(box)
    const toggle = field.getByRole("switch", { name: /Yanındaki rafla sekmeli birleşsin/ })
    expect(toggle).toBeChecked()
    expect(field.getByText(/«İndirimdekiler»/)).toBeVisible()
    // What it does now stays in sight under its name, not behind an (i) (docs/18 §7.1)
    expect(field.getByText(/«İndirimdekiler»/)).not.toHaveClass("sr-only")
    expect(field.queryByRole("button", { name: /^Bilgi:/ })).toBeNull()
    expect(toggle).toHaveAccessibleDescription(/«İndirimdekiler»/)

    await user.click(toggle)
    expect(changes.at(-1)).toMatchObject({ tabs: "off" })
    expect(field.getByText(/ayrı çizilir/)).toBeVisible()
  })

  it("is not offered on a columns rail, which never joins", () => {
    renderPanel(switchVariant(rail("bir0000001"), "columns"))
    expect(screen.queryByRole("switch", { name: /sekmeli birleşsin/ })).toBeNull()
  })
})
