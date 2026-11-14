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

const lookToggle = (name = /^Görünüm ayarları/) => screen.getByRole("button", { name })

/** adr/0049 Ek 2026-11-14 §6: a body section's look, closed at first. */
describe("the section's look settings", () => {
  it("come closed under the content, the fields hidden until opened", async () => {
    renderPanel(newHomeSection("products", "rafyeni001"))

    expect(lookToggle()).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("radiogroup", { name: /Dış boşluk/ })).toBeNull()

    await userEvent.click(lookToggle())

    for (const [label, term] of [
      ["Dış boşluk", "margin"],
      ["İç boşluk", "padding"],
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

  it("sets a step, says how many are set, and puts the theme's own back", async () => {
    const changes = renderPanel(newHomeSection("products", "rafyeni001"))
    await userEvent.click(lookToggle())

    const ground = screen.getByRole("radiogroup", { name: "Zemin background" })
    await userEvent.click(within(ground).getByRole("radio", { name: "Hafif ton" }))

    expect(changes.at(-1)).toMatchObject({ look: { ground: "well", space_outer: null } })
    expect(lookToggle(/1 ayar/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Varsayılana dön" }))

    expect(changes.at(-1)).not.toHaveProperty("look")
    expect(within(ground).getByRole("radio", { name: "Hafif ton" })).not.toBeChecked()
    // The reset button goes: the focus stays on the field, not the page
    expect(within(ground).getByRole("radio", { name: "Sayfa" })).toHaveFocus()
  })

  it("offers only what means something in the section", async () => {
    renderPanel(newHomeSection("faq", "sss000001"))
    await userEvent.click(lookToggle())

    const ground = screen.getByRole("radiogroup", { name: "Zemin background" })
    expect(within(ground).queryByRole("radio", { name: "Ana renk" })).toBeNull()
    expect(within(ground).getByRole("radio", { name: "Koyu" })).toBeInTheDocument()
  })

  it("has no alignment where the words sit on a picture", async () => {
    renderPanel(newHomeSection("hero", "girisbolumu"))
    await userEvent.click(lookToggle())

    expect(screen.queryByRole("radiogroup", { name: /Hizalama/ })).toBeNull()
  })

  it("is not offered for the footer's box", () => {
    renderPanel(newFooterNewsletter("bulten0001"), { group: "footer" })

    expect(screen.queryByRole("button", { name: /^Görünüm ayarları/ })).toBeNull()
  })

  it("opens at the field the settings search picked, focused and marked", () => {
    const target = FIELD_IDS.look("rafyeni001", "ground")
    renderPanel(newHomeSection("products", "rafyeni001"), {
      focus: { target, group: "look", nonce: 1 },
    })

    expect(lookToggle()).toHaveAttribute("aria-expanded", "true")
    const field = document.getElementById(target)
    expect(field).toHaveAttribute("data-highlight")
    expect(field?.querySelector('[role="radio"]')).toHaveFocus()
  })
})
