import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection, FeaturedProductSection } from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { FIELD_IDS } from "./field-registry"
import { openGroup, openTab } from "../settings-groups.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const ID = "yakin00001"

/** The featured product's panel as the editor holds it: every change kept. */
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

const field = () => {
  const found = document.getElementById(FIELD_IDS.content(ID, "gallery"))
  if (!found) throw new Error("no photographs layout field")
  return within(found)
}

/** adr/0049 Ek 2026-11-15: how the featured product's photographs stand. */
describe("the featured product's photographs layout", () => {
  it("shows in Stil › Diziliş, closed at first, the collage chosen for a section saved before it", async () => {
    const user = userEvent.setup()
    renderPanel(newHomeSection("featured_product", ID))

    await openTab(user, "style")
    expect(screen.getByRole("button", { name: "Diziliş" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    await openGroup(user, "Diziliş")
    expect(field().getByText("Fotoğraf düzeni")).toBeInTheDocument()
    expect(field().getByText("gallery")).toBeInTheDocument()
    expect(field().getByRole("radio", { name: "Kolaj" })).toBeChecked()
    expect(field().getByRole("radio", { name: "Çapraz şeritler" })).not.toBeChecked()
    expect(field().queryByRole("button", { name: "Varsayılana dön" })).toBeNull()
  })

  it("saves the strips, says what they do, and goes back to the collage", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("featured_product", ID))
    await openGroup(user, "Diziliş")

    await user.click(field().getByRole("radio", { name: "Çapraz şeritler" }))
    expect(changes.at(-1)).toMatchObject({ type: "featured_product", gallery: "strips" })
    expect(field().getByText(/En çok dört fotoğraf/)).toBeInTheDocument()

    await user.click(field().getByRole("button", { name: "Varsayılana dön" }))
    expect(changes.at(-1)).toMatchObject({ gallery: "collage" })
  })

  it("reads a saved strips layout as chosen", async () => {
    const user = userEvent.setup()
    const section = newHomeSection("featured_product", ID) as FeaturedProductSection
    renderPanel({ ...section, gallery: "strips" })
    await openGroup(user, "Diziliş")

    expect(field().getByRole("radio", { name: "Çapraz şeritler" })).toBeChecked()
  })
})
