import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import i18next from "i18next"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection, LayoutGroup } from "@/features/storefront/api/layout"
import {
  newAnnouncementBar,
  newHeaderMarquee,
  newHomeSection,
} from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { openGroup } from "../settings-groups.fixtures"
import { searchSettings } from "../settings-search"
import { FIELD_IDS, sectionFields } from "./field-registry"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

/** The section's panel as the editor holds it: every change kept. */
function renderPanel(section: AnySection, group: LayoutGroup = "home") {
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

const device = (id: string) => document.getElementById(FIELD_IDS.device(id))

/** The field, there or the test fails. */
function deviceField(id: string): HTMLElement {
  const field = device(id)
  if (!field) throw new Error("no device field")
  return field
}

/** docs/tema/bilesen-standardi §2, denetim O1: which screens show a section. */
describe("the screens a section shows on", () => {
  it("stand in Gelişmiş › Görünürlük of a body section, everywhere at first", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("faq", "sssyeni001"))
    await openGroup(user, "Görünürlük")
    const field = deviceField("sssyeni001")

    const radios = within(field).getAllByRole("radio")
    expect(radios.map((radio) => radio.textContent)).toEqual([
      "Her yerde",
      "Yalnız telefonda",
      "Yalnız masaüstünde",
    ])
    expect(within(field).getByText("device")).toBeInTheDocument()
    expect(radios[0]).toHaveAttribute("aria-checked", "true")
    await user.click(screen.getByRole("radio", { name: /Yalnız telefonda/ }))
    expect(changes.at(-1)).toMatchObject({ device: "mobile" })
    await user.click(screen.getByRole("button", { name: "Varsayılana dön" }))
    expect(changes.at(-1)).toMatchObject({ device: "all" })
  })

  it("come with the header's strip, not with the announcement bar", () => {
    renderPanel(newHeaderMarquee("ustserit01"), "header")
    expect(device("ustserit01")).not.toBeNull()
  })

  it("are not offered where the theme does not hide it", () => {
    renderPanel(newAnnouncementBar("duyuru0001"), "header")
    expect(device("duyuru0001")).toBeNull()
  })

  it("are found by the search in Görünürlük, by word and by term", () => {
    const t = i18next.t.bind(i18next)
    const sections = [
      { section: newHomeSection("banner", "bantyeni01"), group: "home" as const, names: [] },
    ]
    const keys = (query: string) =>
      searchSettings(query, sections, t).map((hit) => hit.field?.key ?? null)

    expect(keys("cihaz")).toContain("device")
    expect(keys("masaüstü")).toContain("device")
    expect(keys("device")).toContain("device")
    expect(
      sectionFields(newHomeSection("banner", "bantyeni01"), "home").find(
        (field) => field.key === "device"
      )?.group
    ).toBe("visibility")
    expect(sectionFields(newAnnouncementBar("duyuru0001"), "header").map((f) => f.key)).toEqual([
      // The top strip's design (owner 2026-11-27)
      "variant",
      "announcement.align",
      "announcement.size",
      "announcement.tone",
      "visible",
      "starts_at",
      "ends_at",
    ])
  })
})
