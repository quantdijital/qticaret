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

const ID = "rafserit01"

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
const STRIPS_FIELDS: ShelfField[] = [
  "strips_count",
  "strips_height",
  "strips_slant",
  "strips_line",
  "strips_overlap",
  "strips_dim",
]

/** Picks a variant in Stil › Biçim, then opens Stil › Diziliş where its fields stand (docs/18 §7.1). */
async function pickVariant(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const variant = await openGroup(user, "Biçim")
  await user.click(within(variant).getByRole("radio", { name }))
  await openGroup(user, "Diziliş")
}

/** adr/0049 Ek 2026-11-16: a product rail's strips in Diziliş, only while it is strips. */
describe("a product rail's strips in Diziliş", () => {
  it("shows the count and look once strips is picked, low and five by default, no card", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", ID))
    await openGroup(user, "Diziliş")
    for (const name of STRIPS_FIELDS) expect(fieldOf(name)).toBeNull()
    expect(screen.getByRole("combobox", { name: /Kart biçimi/ })).toBeVisible()

    await pickVariant(user, /Çapraz şeritler/)
    for (const name of STRIPS_FIELDS) expect(fieldOf(name)).not.toBeNull()
    expect(changes.at(-1)).toMatchObject({
      variant: "strips",
      strips_count: 5,
      strips_height: "low",
      strips_slant: "medium",
      strips_line: "thin",
      strips_overlap: "off",
      strips_dim: "on",
    })
    expect(field("strips_count").getByRole("radio", { name: "5" })).toHaveAttribute(
      "data-state",
      "on"
    )
    expect(field("strips_height").getByRole("radio", { name: "Alçak" })).toHaveAttribute(
      "data-state",
      "on"
    )
    // A strip has no card, so no card choice: a line says why
    expect(screen.queryByRole("combobox", { name: /Kart biçimi/ })).toBeNull()
    expect(screen.getByText(/Bu biçimde kart yok/)).toBeVisible()
  })

  it("offers two to eight products, and sets and resets each step and switch", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", ID))
    await pickVariant(user, /Çapraz şeritler/)

    const counts = field("strips_count").getAllByRole("radio")
    expect(counts.map((radio) => radio.textContent)).toEqual(["2", "3", "4", "5", "6", "7", "8"])
    await user.click(field("strips_count").getByRole("radio", { name: "8" }))
    expect(changes.at(-1)).toMatchObject({ strips_count: 8 })
    await user.click(field("strips_count").getByRole("radio", { name: "2" }))
    expect(changes.at(-1)).toMatchObject({ strips_count: 2 })

    await user.click(field("strips_height").getByRole("radio", { name: "Yüksek" }))
    expect(changes.at(-1)).toMatchObject({ strips_count: 2, strips_height: "high" })
    await user.click(field("strips_height").getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ strips_height: "low" })
    await user.click(field("strips_slant").getByRole("radio", { name: "Keskin" }))
    expect(changes.at(-1)).toMatchObject({ strips_slant: "steep" })

    await user.click(screen.getByRole("switch", { name: /Üst üste bindir/ }))
    expect(changes.at(-1)).toMatchObject({ strips_overlap: "on" })
    await user.click(screen.getByRole("switch", { name: /Diğerlerini karart/ }))
    expect(changes.at(-1)).toMatchObject({ strips_dim: "off" })
  })

  it("hides the strips' fields and drops them on another variant", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", ID))
    await pickVariant(user, /Çapraz şeritler/)
    await user.click(field("strips_count").getByRole("radio", { name: "7" }))

    await pickVariant(user, /Kayan sıra/)
    for (const name of STRIPS_FIELDS) expect(fieldOf(name)).toBeNull()
    expect(screen.queryByText(/Bu biçimde kart yok/)).toBeNull()
    expect(screen.getByRole("combobox", { name: /Kart biçimi/ })).toBeVisible()
    const carousel = changes.at(-1)
    expect(carousel).toMatchObject({ variant: "carousel" })
    for (const name of STRIPS_FIELDS) expect(carousel).not.toHaveProperty(name)
  })
})
