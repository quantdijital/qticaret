import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection, ProductsSection } from "@/features/storefront/api/layout"
import { newBodySection, newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { SectionPanel } from "../section-panel"
import { CARD_FIELD_IDS } from "./card-field-ids"
import { FIELD_IDS } from "./field-registry"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

/** A section's panel as the editor holds it: every change kept. */
function renderPanel(section: AnySection, group: "home" | "product" = "home") {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group={group}
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

/** The field's two steps and the one checked. */
function steps(id: string) {
  const field = document.getElementById(id)
  if (!field) throw new Error(`no field ${id}`)
  const radios = within(field).getAllByRole("radio")
  return {
    names: radios.map((radio) => radio.textContent),
    checked: radios.find((radio) => radio.getAttribute("aria-checked") === "true")?.textContent,
    pick: (name: string) => {
      const radio = radios.find((each) => each.textContent === name)
      if (!radio) throw new Error(`no step ${name}`)
      return userEvent.click(radio)
    },
  }
}

/** docs/tema/bilesen-denetimi (b) 3: cards in a row on a phone. */
describe("the phone's columns", () => {
  it("are a grid rail's, two by default, saved as one when picked", async () => {
    const rail = newHomeSection("products", "raf0000001") as ProductsSection
    const changes = renderPanel(rail)
    const field = steps(FIELD_IDS.shelf("raf0000001", "columns_mobile"))

    expect(field.names).toEqual(["1 kart", "2 kart"])
    expect(field.checked).toBe("2 kart")
    await field.pick("1 kart")
    expect(changes.at(-1)).toMatchObject({ columns_mobile: 1, columns: 3 })
  })

  it("are not offered on a rail that does not stand in a grid", () => {
    const rail = newHomeSection("products", "raf0000001") as ProductsSection
    renderPanel(switchVariant(rail, "carousel"))

    expect(document.getElementById(FIELD_IDS.shelf("raf0000001", "columns_mobile"))).toBeNull()
  })

  it("are the related products' too, beside their cards in a row", async () => {
    const related = newBodySection("product", "related_products", "benzer0001")
    const changes = renderPanel(related, "product")
    const field = steps(FIELD_IDS.content("benzer0001", "columns_mobile"))

    expect(field.checked).toBe("2 kart")
    await field.pick("1 kart")
    expect(changes.at(-1)).toMatchObject({ type: "related_products", columns_mobile: 1 })
  })

  it("are not offered on the picture tiles, which slide sideways on a phone", () => {
    const tiles = newHomeSection("categories", "kategori01")
    if (tiles.type !== "categories" || tiles.variant !== "tiles") throw new Error("not tiles")
    renderPanel(tiles)
    expect(document.getElementById(CARD_FIELD_IDS.card("kategori01", "columns_mobile"))).toBeNull()
  })

  it("start at one card on a linked category grid and save two", async () => {
    const tiles = newHomeSection("categories", "kategori01")
    if (tiles.type !== "categories") throw new Error("not categories")
    const changes = renderPanel(switchVariant(tiles, "linked"))
    const field = steps(CARD_FIELD_IDS.card("kategori01", "columns_mobile"))

    expect(field.checked).toBe("1 kart")
    await field.pick("2 kart")
    expect(changes.at(-1)).toMatchObject({ variant: "linked", columns_mobile: 2 })
  })
})
