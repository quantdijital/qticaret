import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection } from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { openGroup } from "../settings-groups.fixtures"
import { FIELD_IDS } from "./field-registry"
import type { ShelfField } from "./shelf-registry"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const ID = "rafsira001"

/** A product rail's panel as the editor holds it: every change kept. */
function renderPanel(section: AnySection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
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

const fieldOf = (name: ShelfField) => document.getElementById(FIELD_IDS.shelf(ID, name))
const field = (name: ShelfField) => {
  const found = fieldOf(name)
  if (!found) throw new Error(`no ${name} field`)
  return within(found)
}
const RANKED_FIELDS: ShelfField[] = ["ranked_count", "ranked_layout"]

/** Picks a variant in Stil › Biçim, then opens Stil › Diziliş where its fields stand (docs/18 §7.1). */
async function pickVariant(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const variant = await openGroup(user, "Biçim")
  await user.click(within(variant).getByRole("radio", { name }))
  await openGroup(user, "Diziliş")
}

/** adr/0049 Ek 2026-11-16: a product rail's ranked list in Diziliş, only while it is ranked. */
describe("a product rail's ranked list in Diziliş", () => {
  it("shows the count and layout once ranked is picked, five and the first large by default", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", ID))
    await openGroup(user, "Diziliş")
    for (const name of RANKED_FIELDS) expect(fieldOf(name)).toBeNull()
    expect(screen.getByRole("combobox", { name: /Kart biçimi/ })).toBeVisible()

    await pickVariant(user, /Sıralı liste/)
    for (const name of RANKED_FIELDS) expect(fieldOf(name)).not.toBeNull()
    expect(changes.at(-1)).toMatchObject({
      variant: "ranked",
      ranked_count: 5,
      ranked_layout: "lead",
    })
    expect(field("ranked_count").getByRole("radio", { name: "5" })).toHaveAttribute(
      "data-state",
      "on"
    )
    expect(field("ranked_layout").getByRole("radio", { name: "Birinci büyük" })).toHaveAttribute(
      "data-state",
      "on"
    )
    // Its places are drawn from the card's parts, so no card choice: a line says why
    expect(screen.queryByRole("combobox", { name: /Kart biçimi/ })).toBeNull()
    expect(screen.getByText(/Bu biçimde kart biçimi seçilmez/)).toBeVisible()
  })

  it("offers three to ten products, and sets and resets the layout", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", ID))
    await pickVariant(user, /Sıralı liste/)

    const counts = field("ranked_count").getAllByRole("radio")
    expect(counts.map((radio) => radio.textContent)).toEqual([
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ])
    await user.click(field("ranked_count").getByRole("radio", { name: "10" }))
    expect(changes.at(-1)).toMatchObject({ ranked_count: 10 })
    await user.click(field("ranked_count").getByRole("radio", { name: "3" }))
    expect(changes.at(-1)).toMatchObject({ ranked_count: 3 })

    expect(field("ranked_layout").queryByRole("button", { name: /Varsayılana dön/ })).toBeNull()
    await user.click(field("ranked_layout").getByRole("radio", { name: "Tek sıra" }))
    expect(changes.at(-1)).toMatchObject({ ranked_count: 3, ranked_layout: "row" })
    await user.click(field("ranked_layout").getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ ranked_layout: "lead" })
  })

  it("hides the ranked fields and drops them on another variant", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", ID))
    await pickVariant(user, /Sıralı liste/)
    await user.click(field("ranked_count").getByRole("radio", { name: "7" }))

    await pickVariant(user, /Kayan sıra/)
    for (const name of RANKED_FIELDS) expect(fieldOf(name)).toBeNull()
    expect(screen.queryByText(/Bu biçimde kart biçimi seçilmez/)).toBeNull()
    expect(screen.getByRole("combobox", { name: /Kart biçimi/ })).toBeVisible()
    const carousel = changes.at(-1)
    expect(carousel).toMatchObject({ variant: "carousel" })
    for (const name of RANKED_FIELDS) expect(carousel).not.toHaveProperty(name)
  })
})
