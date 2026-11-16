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

const ID = "rafsahne01"

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
const STAGE_FIELDS: ShelfField[] = ["stage_count", "stage_side", "stage_ground", "stage_follow"]

/** Picks a variant in Stil › Biçim, then opens Stil › Diziliş where its fields stand (docs/18 §7.1). */
async function pickVariant(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const variant = await openGroup(user, "Biçim")
  await user.click(within(variant).getByRole("radio", { name }))
  await openGroup(user, "Diziliş")
}

/** adr/0049 Ek 2026-11-16: a product rail's stage list in Diziliş, only while it is one. */
describe("a product rail's stage list in Diziliş", () => {
  it("shows its count, side, ground and follow once picked, four on a graphite stage by default", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", ID))
    await openGroup(user, "Diziliş")
    for (const name of STAGE_FIELDS) expect(fieldOf(name)).toBeNull()

    await pickVariant(user, /Sahne ve liste/)
    for (const name of STAGE_FIELDS) expect(fieldOf(name)).not.toBeNull()
    expect(changes.at(-1)).toMatchObject({
      variant: "stage_list",
      stage_count: 4,
      stage_side: "start",
      stage_ground: "stage",
      stage_follow: "on",
    })
    expect(field("stage_count").getByRole("radio", { name: "4" })).toHaveAttribute(
      "data-state",
      "on"
    )
    expect(field("stage_side").getByRole("radio", { name: "Solda" })).toHaveAttribute(
      "data-state",
      "on"
    )
    expect(field("stage_ground").getByRole("radio", { name: "Koyu" })).toHaveAttribute(
      "data-state",
      "on"
    )
    expect(screen.getByRole("switch", { name: /Satıra gelince sahne değişsin/ })).toBeChecked()
    // Its stage and rows are its own: no card choice, a line says why
    expect(screen.queryByRole("combobox", { name: /Kart biçimi/ })).toBeNull()
    expect(screen.getByText(/sahnedeki ürün büyük görselle/)).toBeVisible()
    // It may join its neighbours' tabs as any rail
    expect(fieldOf("tabs")).not.toBeNull()
  })

  it("offers three to six products, and sets and resets each step and the switch", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", ID))
    await pickVariant(user, /Sahne ve liste/)

    const counts = field("stage_count").getAllByRole("radio")
    expect(counts.map((radio) => radio.textContent)).toEqual(["3", "4", "5", "6"])
    await user.click(field("stage_count").getByRole("radio", { name: "6" }))
    expect(changes.at(-1)).toMatchObject({ stage_count: 6 })

    await user.click(field("stage_side").getByRole("radio", { name: "Sağda" }))
    expect(changes.at(-1)).toMatchObject({ stage_count: 6, stage_side: "end" })
    await user.click(field("stage_side").getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ stage_side: "start" })
    await user.click(field("stage_ground").getByRole("radio", { name: "Hafif ton" }))
    expect(changes.at(-1)).toMatchObject({ stage_ground: "well" })

    await user.click(screen.getByRole("switch", { name: /Satıra gelince sahne değişsin/ }))
    expect(changes.at(-1)).toMatchObject({ stage_follow: "off" })
  })

  it("hides the stage list's fields and drops them on another variant", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", ID))
    await pickVariant(user, /Sahne ve liste/)
    await user.click(field("stage_count").getByRole("radio", { name: "5" }))

    await pickVariant(user, /Öne çıkan/)
    for (const name of STAGE_FIELDS) expect(fieldOf(name)).toBeNull()
    expect(screen.getByRole("combobox", { name: /Kart biçimi/ })).toBeVisible()
    const featured = changes.at(-1)
    expect(featured).toMatchObject({ variant: "featured" })
    for (const name of STAGE_FIELDS) expect(featured).not.toHaveProperty(name)
  })
})
