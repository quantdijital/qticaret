import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection } from "@/features/storefront/api/layout"
import { newBodySection } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { FIELD_IDS } from "./field-registry"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

/** The related products' panel as the editor holds it: every change kept. */
function renderPanel(section: AnySection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group="product"
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

const ID = "benzer0001"
const byId = (id: string) => document.getElementById(id)

/** docs/tema/bilesen-denetimi (b) 7: the related products as a rail's grid or carousel. */
describe("the related products' variant and card", () => {
  it("start as today's grid with its columns and the theme's card", () => {
    renderPanel(newBodySection("product", "related_products", ID))
    const variant = byId(FIELD_IDS.variant(ID))
    if (!variant) throw new Error("no variant field")

    expect(
      within(variant)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Izgara", "Kayan sıra"])
    expect(byId(FIELD_IDS.content(ID, "columns"))).not.toBeNull()
    expect(byId(FIELD_IDS.content(ID, "card_variant"))).not.toBeNull()
    expect(screen.queryByRole("button", { name: "Kaydırma" })).toBeNull()
  })

  it("slide with the scroller kit once switched, the columns dropped, the card kept", async () => {
    const changes = renderPanel(newBodySection("product", "related_products", ID))
    const variant = byId(FIELD_IDS.variant(ID))
    if (!variant) throw new Error("no variant field")

    await userEvent.click(within(variant).getByRole("radio", { name: /Kayan sıra/ }))

    const last = changes.at(-1)
    expect(last).toMatchObject({ type: "related_products", variant: "carousel" })
    expect(last).not.toHaveProperty("columns")
    expect(last).toHaveProperty("scroller")
    expect(byId(FIELD_IDS.content(ID, "columns"))).toBeNull()
    expect(byId(FIELD_IDS.scroller(ID, "desktop"))).not.toBeNull()
    expect(byId(FIELD_IDS.content(ID, "card_variant"))).not.toBeNull()
  })
})
