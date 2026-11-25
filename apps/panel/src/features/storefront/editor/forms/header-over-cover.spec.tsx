import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
import type { AnySection, HeaderBarSection } from "@/features/storefront/api/layout"
import { SectionPanel } from "../section-panel"
import { searchSettings } from "../settings-search"
import { openTab } from "../settings-groups.fixtures"
import { headerSetIn } from "./header-marks"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const inline: HeaderBarSection = {
  id: "mainheader",
  type: "header_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "inline",
  sticky: true,
  menu_images: "submenus",
  search_style: "icon",
}

/** The bar's panel as the editor holds it: every change kept. */
function renderBar(section: HeaderBarSection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState<AnySection>(section)
    return (
      <SectionPanel
        section={value}
        group="header"
        problems={{}}
        canDuplicate={false}
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

const NAME = /Kapak görselinin üstünde/

/** The one-row header over a full photograph opening: a switch, off until chosen. */
describe("the header over the opening", () => {
  it("offers the one-row header a switch beside sticky, off by default, and saves it", async () => {
    const user = userEvent.setup()
    const changes = renderBar(inline)
    await openTab(user, "advanced")
    const toggle = screen.getByRole("switch", { name: NAME })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(changes.at(-1)).toMatchObject({ variant: "inline", over_cover: true })
    await user.click(screen.getByRole("switch", { name: NAME }))
    expect(changes.at(-1)).toMatchObject({ over_cover: false })
  })

  it("is not offered on the other headers", async () => {
    const user = userEvent.setup()
    renderBar({ ...inline, variant: "standard" })
    await openTab(user, "advanced")
    expect(screen.queryByRole("switch", { name: NAME })).toBeNull()
  })

  it("is found by its everyday words and its term on the one-row header only", () => {
    const t = i18next.t.bind(i18next)
    const keys = (section: HeaderBarSection, query: string) =>
      searchSettings(query, [{ section, group: "header", names: [] }], t).map(
        (hit) => hit.field?.key ?? null
      )
    expect(keys(inline, "kapak görselinin")).toContain("over_cover")
    expect(keys(inline, "transparent")).toContain("over_cover")
    expect(keys({ ...inline, variant: "standard" }, "kapak görselinin")).not.toContain("over_cover")
  })

  it("counts in its group's mark only once switched on", () => {
    expect(headerSetIn(inline, "look")).toBe(0)
    expect(headerSetIn({ ...inline, over_cover: false }, "look")).toBe(0)
    expect(headerSetIn({ ...inline, over_cover: true }, "look")).toBe(1)
  })
})
