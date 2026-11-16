import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection, LayoutGroup } from "@/features/storefront/api/layout"
import { newFooterNewsletter, newHomeSection } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import type { FieldFocus } from "../use-field-focus"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { openGroup, openTab } from "../settings-groups.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

/** The section's panel as the editor holds it: every change kept. */
function renderPanel(
  section: AnySection,
  {
    group = "home",
    focus = null,
  }: {
    group?: LayoutGroup
    focus?: (FieldFocus & { group: FieldGroupName }) | null
  } = {}
) {
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
        focus={focus}
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

const groupToggle = (name: RegExp) => screen.getByRole("button", { name })

/**
 * adr/0049 Ek 2026-11-14 §6, adr/0065 Ek (sekmeler): a body section's
 * look, its ground, alignment and width in "Görünüm" under "Stil", the
 * space around and inside it in "Boşluk" under "Gelişmiş", both closed.
 */
describe("the section's look settings", () => {
  it("come closed in Stil › Görünüm, the fields hidden until opened", async () => {
    const user = userEvent.setup()
    renderPanel(newHomeSection("products", "rafyeni001"))
    await openTab(user, "style")

    expect(groupToggle(/^Görünüm/)).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("radiogroup", { name: /Zemin/ })).toBeNull()

    await user.click(groupToggle(/^Görünüm/))

    for (const [label, term] of [
      ["Zemin", "background"],
      ["Hizalama", "text-align"],
      ["Genişlik", "width"],
    ]) {
      const field = screen.getByRole("radiogroup", { name: `${label ?? ""} ${term ?? ""}` })
      expect(within(field).getAllByRole("radio").length).toBeGreaterThan(1)
    }
    // An unset field says nothing more: the group's hint covers it
    expect(screen.queryByText(/temanın ölçüsünden/)).not.toBeInTheDocument()
  })

  it("keeps the space above, below and inside in Gelişmiş › Boşluk (sahip 2026-11-15)", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", "rafyeni001"))
    await openGroup(user, "Boşluk")

    expect(groupToggle(/^Boşluk/)).toHaveAttribute("aria-expanded", "true")
    const above = screen.getByRole("radiogroup", { name: "Üst boşluk margin-top" })
    const below = screen.getByRole("radiogroup", { name: "Alt boşluk margin-bottom" })
    expect(screen.getByRole("radiogroup", { name: "İç boşluk padding" })).toBeInTheDocument()
    expect(
      within(below)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Yok", "Dar", "Orta", "Geniş"])
    expect(within(above).getByRole("radio", { name: "Orta" })).not.toBeChecked()

    await user.click(within(below).getByRole("radio", { name: "Dar" }))

    expect(changes.at(-1)).toMatchObject({ look: { space_below: "small", space_outer: null } })
    // The group's mark says how many of its settings are set
    expect(groupToggle(/^Boşluk, 1 ayar varsayılandan farklı/)).toBeInTheDocument()
  })

  it("sets a step, marks the group, and puts the theme's own back", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("products", "rafyeni001"))
    await openGroup(user, "Görünüm")

    const ground = screen.getByRole("radiogroup", { name: "Zemin background" })
    await user.click(within(ground).getByRole("radio", { name: "Hafif ton" }))

    expect(changes.at(-1)).toMatchObject({ look: { ground: "well", space_outer: null } })
    expect(groupToggle(/^Görünüm, 1 ayar/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Varsayılana dön" }))

    expect(changes.at(-1)).not.toHaveProperty("look")
    expect(within(ground).getByRole("radio", { name: "Hafif ton" })).not.toBeChecked()
    // The reset button goes: the focus stays on the field, not the page
    expect(within(ground).getByRole("radio", { name: "Sayfa" })).toHaveFocus()
    expect(groupToggle(/^Görünüm$/)).toBeInTheDocument()
  })

  it("offers only what means something in the section", async () => {
    const user = userEvent.setup()
    renderPanel(newHomeSection("faq", "sss000001"))
    await openGroup(user, "Görünüm")

    const ground = screen.getByRole("radiogroup", { name: "Zemin background" })
    expect(within(ground).queryByRole("radio", { name: "Ana renk" })).toBeNull()
    expect(within(ground).getByRole("radio", { name: "Koyu" })).toBeInTheDocument()
  })

  it("has no alignment where the words sit on a picture", async () => {
    const user = userEvent.setup()
    renderPanel(newHomeSection("hero", "girisbolumu"))
    await openGroup(user, "Görünüm")

    expect(screen.getByRole("radiogroup", { name: /Zemin/ })).toBeInTheDocument()
    expect(screen.queryByRole("radiogroup", { name: /Hizalama/ })).toBeNull()
  })

  it("is not offered for the footer's box", () => {
    renderPanel(newFooterNewsletter("bulten0001"), { group: "footer" })

    expect(document.querySelector('[data-panel-group="frame"]')).toBeNull()
    expect(document.querySelector('[data-panel-group="spacing"]')).toBeNull()
  })

  it("opens at the field the settings search picked, its tab and group open, focused and marked", () => {
    const target = FIELD_IDS.look("rafyeni001", "ground")
    renderPanel(newHomeSection("products", "rafyeni001"), {
      focus: { target, group: "frame", nonce: 1 },
    })

    expect(screen.getByRole("tab", { name: /^Stil/ })).toHaveAttribute("aria-selected", "true")
    expect(groupToggle(/^Görünüm/)).toHaveAttribute("aria-expanded", "true")
    const field = document.getElementById(target)
    expect(field).toHaveAttribute("data-highlight")
    expect(field?.querySelector('[role="radio"]')).toHaveFocus()
  })
})
