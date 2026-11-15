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
import { FIELD_IDS } from "./field-registry"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const ID = "seritler01"

/** The strip gallery's panel as the editor holds it: every change kept. */
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

const field = (name: string) => {
  const found = document.getElementById(FIELD_IDS.content(ID, name as "width"))
  if (!found) throw new Error(`no ${name} field`)
  return within(found)
}

/** adr/0049 Ek 2026-11-16: the strip gallery's settings, open under its content. */
describe("the strip gallery's Diziliş group", () => {
  it("offers its steps and switches with the contract's defaults, each set and reset", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("strip_gallery", ID))
    expect(field("width").getByRole("radio", { name: "Tam genişlik" })).toHaveAttribute(
      "data-state",
      "on"
    )
    expect(field("height").getByRole("radio", { name: "Orta" })).toHaveAttribute("data-state", "on")
    expect(field("captions").getByRole("radio", { name: "Göster" })).toHaveAttribute(
      "data-state",
      "on"
    )
    expect(field("strips_slant").getByRole("radio", { name: "Orta" })).toHaveAttribute(
      "data-state",
      "on"
    )
    expect(field("strips_line").getByRole("radio", { name: "İnce" })).toHaveAttribute(
      "data-state",
      "on"
    )

    await user.click(field("width").getByRole("radio", { name: "Kutulu" }))
    expect(changes.at(-1)).toMatchObject({ width: "boxed" })
    await user.click(field("strips_slant").getByRole("radio", { name: "Keskin" }))
    expect(changes.at(-1)).toMatchObject({ width: "boxed", strips_slant: "steep" })
    await user.click(field("strips_slant").getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ strips_slant: "medium" })

    await user.click(screen.getByRole("switch", { name: /Üst üste bindir/ }))
    expect(changes.at(-1)).toMatchObject({ strips_overlap: "on" })
    expect(screen.getByRole("switch", { name: /Diğerlerini karart/ })).toBeChecked()
    await user.click(screen.getByRole("switch", { name: /Diğerlerini karart/ }))
    expect(changes.at(-1)).toMatchObject({ strips_dim: "off" })
  })
})
