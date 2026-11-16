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
import { openTab } from "../settings-groups.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

/** The section's panel as the editor holds it: every change kept. */
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
        badges={[{ icon: "truck", title: "Aynı gün kargo", text: null }]}
        onBadges={vi.fn()}
      />
    )
  }
  // Nothing is asked of the server here: the form's details menu stays closed
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
  return changes
}

/** adr/0049 Ek 2026-11-14 §2.6: "Biçim" at the head of a section's settings. */
describe("the section's variant choice", () => {
  it("draws each variant in small with its everyday name, the section's own picked", async () => {
    const user = userEvent.setup()
    renderPanel(newHomeSection("trust_badges", "guvenserit"))
    // Under "Stil", the variant's group the one open at first
    await openTab(user, "style")

    const choice = screen.getByRole("group", { name: "Biçim" })
    const strip = within(choice).getByRole("radio", { name: "Şerit" })
    const lined = within(choice).getByRole("radio", { name: "Çizgili kutular" })
    expect(strip).toBeChecked()
    expect(lined).not.toBeChecked()
    expect(strip.querySelector("svg")).not.toBeNull()
    expect(lined.querySelector("svg")).not.toBeNull()
  })

  it("switches the section to the picked variant, one change", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("trust_badges", "guvenserit"))
    await openTab(user, "style")

    await user.click(screen.getByRole("radio", { name: "Çizgili kutular" }))
    await user.click(screen.getByRole("radio", { name: "Çizgili kutular" }))

    expect(changes).toEqual([expect.objectContaining({ id: "guvenserit", variant: "lined" })])
    expect(screen.getByRole("radio", { name: "Çizgili kutular" })).toBeChecked()
  })

  it("is not offered for a type drawn one way", () => {
    renderPanel(newHomeSection("help", "yardim0001"))

    expect(screen.queryByRole("group", { name: "Biçim" })).toBeNull()
    expect(screen.queryByText("Biçim")).toBeNull()
  })
})
